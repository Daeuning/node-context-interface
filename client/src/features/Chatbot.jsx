import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import { useDispatch, useSelector } from "react-redux";
import { sendMessageToApi } from "../services/chatbotService.js";
import DialogBox from "../components/textBox/DialogBox.jsx";
import { setCurrentScrolledDialog } from "../redux/slices/nodeSlice";

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
`;

const MessagesContainer = styled.div`
  flex: 1;
  width: 100%;
  padding: 20px;
  overflow-y: auto;
  scrollbar-width: none;
`;

const InputContainer = styled.div`
  display: flex;
  width: 80%;
  height: 40px;
  align-items: center;
  justify-content: center;
  padding: 5px 13px 5px 20px;
  border-radius: 100px;
  background-color: #f0f0f0;
`;

const Input = styled.input`
  height: 20px;
  flex: 1;
  border: none;
  background-color: #f0f0f0;
  margin-right: 10px;
  font-size: 16px;
  font-family: "Pretendard";

  &:focus {
    outline: none;
  }
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  height: 35px;
  border: none;
  border-radius: 50%;
  background-color: #486055;
  cursor: pointer;
`;

const ArrowContainer = styled.div`
  position: fixed;
  bottom: 100px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const ArrowButton = styled.button`
  width: 40px;
  height: 40px;
  background-color: #48bb78;
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  pointer-events: ${(props) => (props.disabled ? "none" : "auto")};
`;


function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);  // 🔥 현재 활성 대화 인덱스
  const messagesEndRef = useRef(null);
  const messageRefs = useRef([]);  // 🔥 메시지별 Ref 배열
  const dispatch = useDispatch();

  const dialogNumber = useSelector((state) => state.node.dialogCount);
  const activeDialogNumbers = useSelector((state) => state.node.activeDialogNumbers);  // 🔥 활성화된 대화 번호들

  // 🔥 대화 스크롤 이동 함수
  const scrollToMessage = (index) => {
    if (messageRefs.current[index]) {
      messageRefs.current[index].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // 🔥 대화 추가 시 맨 아래로 스크롤
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // 🔥 활성화된 대화 번호가 변경될 때 첫 번째로 스크롤
  useEffect(() => {
    if (activeDialogNumbers.length > 0) {
      const lastIndex = activeDialogNumbers.length - 1;
      setCurrentIndex(lastIndex);
      scrollToMessage(activeDialogNumbers[lastIndex] - 1);
    }
  }, [activeDialogNumbers]);

  // 🔥 새로운 대화가 추가될 때 아래로 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 🔥 화살표 클릭 시 대화 이동
  const moveToMessage = (direction) => {
    const allActiveDialogNumbers = messages
      .filter((msg) => activeDialogNumbers.includes(msg.number))
      .map((msg) => msg.number);
  
    const currentDialogIndex = allActiveDialogNumbers.indexOf(activeDialogNumbers[currentIndex]);
    const nextIndex = currentDialogIndex + direction;

    if (nextIndex >= 0 && nextIndex < allActiveDialogNumbers.length) {
        const nextMessageNumber = allActiveDialogNumbers[nextIndex];
        setCurrentIndex(nextIndex);
        dispatch(setCurrentScrolledDialog(nextMessageNumber)); // 🔥 현재 이동한 대화 번호 설정
        scrollToMessage(nextMessageNumber - 1);
    }
  };


  const handleSend = async () => {
    if (input.trim() === "") return;

    const userMessage = {
      role: "user",
      content: input,
      nodeId: "root",
      number: messages.length + 1,
    };

    let updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");

    try {
      const gptMessageContent = await dispatch(sendMessageToApi(input, updatedMessages));
      const gptMessage = {
        role: "assistant",
        content: gptMessageContent,
        nodeId: "root",
        number: updatedMessages.length + 1,
      };
      updatedMessages = [...updatedMessages, gptMessage];
      setMessages(updatedMessages);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <ChatContainer>
      <MessagesContainer>
        {messages.map((msg, index) => (
          <div
            key={index}
            ref={(el) => (messageRefs.current[index] = el)}  // 🔥 각 메시지에 ref 할당
          >
            <DialogBox
              text={msg.content}
              isUser={msg.role === "user"}
              nodeId={msg.nodeId}
              number={msg.number}
            />
          </div>
        ))}
        <div ref={messagesEndRef} />
      </MessagesContainer>
      {activeDialogNumbers.length > 0 && (
        <ArrowContainer>
          <ArrowButton onClick={() => moveToMessage(-1)} disabled={currentIndex <= 0}>
            ↑
          </ArrowButton>
          <ArrowButton onClick={() => moveToMessage(1)} disabled={currentIndex >= activeDialogNumbers.length - 1}>
            ↓
          </ArrowButton>
        </ArrowContainer>
      )}
      <InputContainer>
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메세지 입력하기"
        />
        <Button onClick={handleSend}>
          <span className="material-symbols-outlined md-white md-24">arrow_upward</span>
        </Button>
      </InputContainer>
    </ChatContainer>
  );
}


export default Chatbot;
