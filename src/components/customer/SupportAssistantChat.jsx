import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Bot, 
  Send, 
  X, 
  Loader2,
  ArrowRight,
  MessageSquare,
  Paperclip,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';

const QUICK_SUGGESTIONS = [
  "My computer is slow",
  "Can't connect to WiFi",
  "Printer not working",
  "Email issues",
  "Password reset"
];

export default function SupportAssistantChat({ 
  onCreateTicket, 
  onClose,
  initialMessage = '',
  customerId
}) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState(initialMessage);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [attachedImages, setAttachedImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    initConversation();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initConversation = async () => {
    try {
      // Fetch customer-specific AI instructions if customerId provided
      let customerInstructions = '';
      if (customerId) {
        try {
          const customers = await base44.entities.Customer.filter({ id: customerId });
          if (customers.length > 0 && customers[0].ai_support_instructions) {
            customerInstructions = customers[0].ai_support_instructions;
          }
        } catch (e) {
          console.error('Failed to fetch customer instructions:', e);
        }
      }

      const conv = await base44.agents.createConversation({
        agent_name: 'support_assistant',
        metadata: { 
          name: 'Support Chat',
          customer_id: customerId,
          custom_instructions: customerInstructions
        }
      });
      setConversation(conv);
      
      // Subscribe to updates
      base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages(data.messages || []);
      });

      // Send initial greeting from assistant
      setMessages([{
        role: 'assistant',
        content: "Hi! I'm here to help. What's the issue?"
      }]);
      
      setIsInitializing(false);
    } catch (error) {
      console.error('Failed to init conversation:', error);
      setIsInitializing(false);
    }
  };

  const handleSend = async () => {
    if ((!inputValue.trim() && attachedImages.length === 0) || !conversation || isLoading) return;

    const userMessage = inputValue.trim();
    const images = [...attachedImages];
    setInputValue('');
    setAttachedImages([]);
    setIsLoading(true);

    try {
      const messagePayload = {
        role: 'user',
        content: userMessage || (images.length > 0 ? '[Image attached]' : '')
      };
      
      if (images.length > 0) {
        messagePayload.file_urls = images;
      }

      await base44.agents.addMessage(conversation, messagePayload);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setIsUploading(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setAttachedImages(prev => [...prev, file_url]);
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        
        setIsUploading(true);
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          setAttachedImages(prev => [...prev, file_url]);
        } catch (error) {
          console.error('Failed to upload pasted image:', error);
        } finally {
          setIsUploading(false);
        }
        break;
      }
    }
  };

  const removeImage = (index) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
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

  // Generate a summary from conversation for ticket prefill
  const generateTicketSummary = () => {
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return '';
    // Use first user message as summary basis
    return userMessages[0]?.content?.slice(0, 100) || '';
  };

  // Generate details from full conversation
  const generateTicketDetails = () => {
    const transcript = getConversationTranscript();
    const userMessages = messages.filter(m => m.role === 'user');
    
    // Build structured details
    let details = '';
    if (userMessages.length > 1) {
      details = `Issue Description:\n${userMessages[0]?.content || ''}\n\n`;
      details += `Additional Information from Troubleshooting:\n`;
      userMessages.slice(1).forEach((msg, i) => {
        details += `- ${msg.content}\n`;
      });
    } else if (userMessages.length === 1) {
      details = userMessages[0]?.content || '';
    }
    
    return details;
  };

  const handleCreateTicketWithConversation = () => {
    onCreateTicket(generateTicketSummary(), generateTicketDetails(), getConversationTranscript());
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
          onClick={handleCreateTicketWithConversation}
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
                {msg.file_urls?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {msg.file_urls.map((url, i) => (
                      <img 
                        key={i} 
                        src={url} 
                        alt="Attached" 
                        className="max-w-[200px] max-h-[150px] object-contain rounded-lg"
                      />
                    ))}
                  </div>
                )}
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
        
        {/* Quick Suggestions - Show only at start */}
        {messages.length === 1 && !isLoading && (
          <div className="flex flex-wrap gap-2 px-2">
            {QUICK_SUGGESTIONS.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputValue(suggestion);
                }}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-white">
        {/* Attached Images Preview */}
        {attachedImages.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {attachedImages.map((url, idx) => (
              <div key={idx} className="relative group">
                <img 
                  src={url} 
                  alt="Attached" 
                  className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isInitializing || isUploading}
            className="flex-shrink-0"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </Button>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            onPaste={handlePaste}
            placeholder="Describe your issue... (paste images with Ctrl+V)"
            disabled={isLoading || isInitializing}
            className="flex-1"
          />
          <Button 
            onClick={handleSend}
            disabled={(!inputValue.trim() && attachedImages.length === 0) || isLoading || isInitializing}
            size="icon"
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Can't resolve it? <button onClick={handleCreateTicketWithConversation} className="text-purple-600 hover:underline">Submit a ticket instead</button>
        </p>
      </div>
    </div>
  );
}