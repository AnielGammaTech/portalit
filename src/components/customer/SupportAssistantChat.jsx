import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Bot, 
  Send, 
  X, 
  Loader2,
  ArrowRight,
  MessageSquare
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';

export default function SupportAssistantChat({ 
  onCreateTicket, 
  onClose,
  initialMessage = ''
}) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState(initialMessage);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    initConversation();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initConversation = async () => {
    try {
      const conv = await base44.agents.createConversation({
        agent_name: 'support_assistant',
        metadata: { name: 'Support Chat' }
      });
      setConversation(conv);
      
      // Subscribe to updates
      base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages(data.messages || []);
      });

      // Send initial greeting from assistant
      setMessages([{
        role: 'assistant',
        content: "Hi! I'm your IT support assistant. Before we create a ticket, let me try to help you troubleshoot.\n\n**What issue are you experiencing?**\n\nDescribe your problem and I'll suggest some solutions. If we can't resolve it together, you can always skip ahead and submit a ticket."
      }]);
      
      setIsInitializing(false);
    } catch (error) {
      console.error('Failed to init conversation:', error);
      setIsInitializing(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !conversation || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    try {
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: userMessage
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getLastUserMessage = () => {
    const userMessages = messages.filter(m => m.role === 'user');
    return userMessages[userMessages.length - 1]?.content || '';
  };

  const getConversationTranscript = () => {
    return messages.map(m => {
      const role = m.role === 'user' ? 'Customer' : 'AI Assistant';
      return `${role}: ${m.content}`;
    }).join('\n\n');
  };

  const handleCreateTicketWithConversation = (prefillSummary = '') => {
    onCreateTicket(prefillSummary, getConversationTranscript());
  };

  return (
    <div className="flex flex-col h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 text-sm">Support Assistant</h2>
            <p className="text-xs text-slate-500">Let me help troubleshoot</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => handleCreateTicketWithConversation(getLastUserMessage())}
          className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 gap-1 text-xs"
        >
          Skip to ticket
          <ArrowRight className="w-3 h-3" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {isInitializing ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={cn(
                "flex gap-3",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-purple-600" />
                </div>
              )}
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5",
                msg.role === 'user' 
                  ? "bg-purple-600 text-white" 
                  : "bg-white border border-slate-200 shadow-sm"
              )}>
                {msg.role === 'user' ? (
                  <p className="text-sm">{msg.content}</p>
                ) : (
                  <ReactMarkdown className="text-sm prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-purple-600" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe your issue..."
            disabled={isLoading || isInitializing}
            className="flex-1"
          />
          <Button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading || isInitializing}
            size="icon"
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Can't resolve it? <button onClick={() => handleCreateTicketWithConversation(getLastUserMessage())} className="text-purple-600 hover:underline">Submit a ticket instead</button>
        </p>
      </div>
    </div>
  );
}