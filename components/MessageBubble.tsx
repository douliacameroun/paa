
import React, { useState } from 'react';
import { Message, MessagePart } from '../types';

interface MessageBubbleProps {
  message: Message;
  isSpeaking: boolean; // Prop from ChatWindow to indicate if *any* bot audio is speaking
}

const renderMessagePart = (part: MessagePart, index: number, isBotMessage: boolean) => {
  switch (part.type) {
    case 'link':
      return (
        <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:underline">
          {part.text}
        </a>
      );
    case 'bold':
      return <strong key={index}>{part.text}</strong>; // Removed text-[#D4AF37] for bot messages
    case 'error':
      return <span key={index} className="text-red-500">{part.text}</span>;
    case 'audio':
      // This part is handled by the MessageBubble component directly for playback,
      // but we return nothing here as it's a "display" part, not text to render inline.
      return null;
    case 'file':
      // Display file icon and name for uploaded files
      return (
        <div key={index} className="flex items-center space-x-2 text-sm text-gray-700 bg-gray-100 p-2 rounded-md my-1">
          <span role="img" aria-label="PDF icon" className="text-red-500 text-lg">📄</span>
          <span>{part.fileName}</span>
          {/* Optionally add a download link if fileData is present and you want to allow re-download */}
        </div>
      );
    case 'text':
    default:
      const rawText = part.text || '';
      // Split by double newlines for paragraphs
      const paragraphs = rawText.split('\n\n');

      return paragraphs.map((para, paraIndex) => {
        let content;
        if (para.startsWith('## ')) {
          // Treat as a title for the chatbot, apply bold
          content = <strong className="text-lg block my-2" key={paraIndex}>{para.substring(3).trim()}</strong>; // Removed text-[#D4AF37]
        } else {
          // General text, apply bold for **text** within
          const segments = para.split(/(\*\*.*?\*\*)/g).map((segment, segIndex) => {
            if (segment.startsWith('**') && segment.endsWith('**')) {
              // Apply bold without specific color for bot messages
              return <strong key={segIndex}>{segment.slice(2, -2)}</strong>; // Removed text-[#D4AF37]
            }
            return segment;
          });
          content = <span key={paraIndex}>{segments}</span>;
        }
        return <p key={paraIndex} className="mb-2 last:mb-0">{content}</p>; // Use p tag for paragraphs
      });
  }
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isSpeaking }) => {
  const isUser = message.sender === 'user';
  const hasAudio = message.parts.some(p => p.type === 'audio' && p.audioBase64);

  const bubbleClasses = isUser
    ? 'bg-[#E6EEF9] text-[#002366] self-end rounded-bl-xl' // Light blue for user, text dark blue
    : 'bg-[#F8F8F8] text-[#002366] self-start rounded-br-xl shadow'; // Blanc Cassé for bot, text dark blue

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] p-4 rounded-t-xl ${bubbleClasses} ${!isUser && hasAudio && isSpeaking ? 'ring-2 ring-[#D4AF37]' : ''}`}
      >
        {message.parts.map((part, index) => renderMessagePart(part, index, !isUser))}
        {!isUser && hasAudio && (
          <div className="mt-2 flex items-center justify-end">
            {isSpeaking ? (
              <span className="text-xl text-[#D4AF37] animate-pulse" aria-label="Bot is speaking">🔊</span>
            ) : (
              <span className="text-xl text-gray-500" aria-label="Audio available">🔈</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};