
import React from 'react';
import { Message } from '../types';
import { MessageBubble } from './MessageBubble';
import { Spinner } from './Spinner';

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  isSpeaking: boolean; // New prop to indicate if bot is speaking
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ messages, isLoading, isSpeaking }) => {
  return (
    <div className="flex flex-col space-y-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} isSpeaking={isSpeaking} />
      ))}
      {isLoading && (
        <div className="flex items-center justify-center p-2">
          <Spinner />
          <span className="ml-2 text-neutral-500">Réponse de DOULIA...</span>
        </div>
      )}
    </div>
  );
};
