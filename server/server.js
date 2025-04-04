require('dotenv').config();
const express = require('express');
const path = require('path'); 
const OpenAI = require('openai');
const cors = require('cors'); 

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.static(path.join(__dirname, 'public')));

// 🟢 재시도 함수 - 응답 비어있을 때도 재시도
async function retryRequest(callback, maxRetries = 5) {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      const response = await callback();
      const gptResult = response?.choices?.[0]?.message?.content?.trim();
      
      // 응답 비어 있는 경우 다시 요청
      if (!gptResult) {
        throw new Error("GPT 응답이 비어 있음 - 재시도");
      }

      return response;
    } catch (error) {
      attempts++;
      console.error(`❌ 재시도 중... (${attempts}/${maxRetries}) - 오류: ${error.message}`);
      if (attempts >= maxRetries) throw error;
    }
  }
}

app.post('/api/chat', async (req, res) => {  
  const userPrompt = req.body.message;  
  const previousMessages = req.body.history || [];  

  // ✅ 대화 기록 콘솔 출력
  console.log('💬 대화 기록 (previousMessages):', JSON.stringify(previousMessages, null, 2));
  console.log('🧑‍💬 사용자 입력 (userPrompt):', userPrompt);

  try {
    const response = await retryRequest(() => openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: "system", 
          content: "사용자의 질문에 대한 답변을 해줘"
        },
        ...previousMessages,
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 800,
    }));

    const gptResult = response.choices[0].message.content;
    
    // 🔥 응답이 비어 있는 경우 강제 재시도
    if (!gptResult) {
      console.error("❗️ GPT 응답이 비어 있음! 재시도...");
      throw new Error("Empty response from GPT");
    }

    const parsedResult = JSON.parse(gptResult); 
    const gptResponse = parsedResult.response;
    const keyword = parsedResult.keyword; 

    console.log('✅ GPT Result:', gptResult);
    console.log('✅ Keyword:', keyword);

    res.json({ message: gptResponse, keyword });
     
  } catch (error) {
    console.error('❌ Error generating response:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ✅ keyword 추출 + 부모 노드 선택 + 관계 설정
app.post('/api/update-graph', async (req, res) => {
  const { nodes, userMessage, gptMessage } = req.body;
  const safeNodes = nodes || {};
  const existingKeywords = Object.values(safeNodes).map(node => node.keyword);

  try {
    const response = await retryRequest(() => openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `
          1. 다음 사용자 질문과 GPT 응답을 읽고 핵심 키워드를 단 1개 추출해. 
          2. 해당 키워드를 기존 노드 중 어떤 것에 연결할지 판단하고, 적절한 부모 노드를 설정해.
          3. 부모-자식 관계를 한 단어 또는 짧은 구로 명확히 표현해.
          반드시 아래와 같은 JSON 형식으로 응답해.
        `},
        { role: 'user', content: `노드 목록: ${JSON.stringify(existingKeywords)}` },
        { role: 'user', content: `그래프 구조: ${JSON.stringify(safeNodes, null, 2)}` },
        { role: 'user', content: `사용자 질문: ${userMessage}` },
        { role: 'user', content: `GPT 응답: ${gptMessage}` },
        { role: 'user', content: `
          올바른 JSON 예시:
          \`\`\`json
          {
            "keyword": "예술",
            "parentNodeId": "culture-1",
            "relation": "관련"
          }
          \`\`\`
        ` }
      ],
      max_tokens: 800,
      temperature: 0.2,
      response_format: { type: "json_object" }
    }));

    const resultText = response.choices[0].message.content;
    const parsed = JSON.parse(resultText);

    let { keyword, parentNodeId, relation } = parsed;

    if (!keyword) throw new Error("❌ 키워드가 추출되지 않았습니다.");

    parentNodeId = parentNodeId?.trim() || "root";
    relation = relation?.trim() || "관련";

    if (!safeNodes[parentNodeId]) {
      parentNodeId = Object.keys(safeNodes).find(id => keyword.includes(safeNodes[id].keyword)) || "root";
    }

    res.json({ keyword, parentNodeId, relation });

  } catch (error) {
    console.error("❌ /api/update-graph error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(8080, () => {
  console.log('🚀 Server is listening on port 8080');
});