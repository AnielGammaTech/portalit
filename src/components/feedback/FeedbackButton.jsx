import React, { useState, useRef, useEffect, useCallback } from 'react';
import { client } from '@/api/client';
import { MessageSquarePlus, X, Upload, Image, Bug, Lightbulb, HelpCircle, Send, Loader2, Paperclip } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

const feedbackTypes = [
  { value: 'bug', label: 'Bug', icon: Bug, activeClass: 'border-red-500 bg-red-50 text-red-700' },
  { value: 'feature', label: 'Feature', icon: Lightbulb, activeClass: 'border-amber-500 bg-amber-50 text-amber-700' },
  { value: 'question', label: 'Question', icon: HelpCircle, activeClass: 'border-blue-500 bg-blue-50 text-blue-700' },
  { value: 'other', label: 'Other', icon: MessageSquarePlus, activeClass: 'border-slate-500 bg-slate-50 text-slate-700' },
];

export default function FeedbackButton({ user, customer }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState('bug');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const panelRef = useRef(null);
  const textareaRef = useRef(null);

  const resetForm = useCallback(() => {
    setType('bug');
    setSubject('');
    setDescription('');
    setScreenshots([]);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && open) handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      document.body.style.scrollbarGutter = 'stable';
    } else {
      document.body.style.overflow = '';
      document.body.style.scrollbarGutter = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.scrollbarGutter = '';
    };
  }, [open]);

  const uploadFiles = async (files) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setUploading(true);
    try {
      const results = await Promise.all(
        imageFiles.map(file => client.integrations.Core.UploadFile({ file }))
      );
      const urls = results.map(r => r.file_url);
      setScreenshots(prev => [...prev, ...urls]);
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = (e) => {
    uploadFiles(Array.from(e.target.files));
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) uploadFiles(imageFiles);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  };

  const removeScreenshot = (index) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('Please describe your feedback');
      return;
    }

    setSubmitting(true);
    try {
      await client.entities.Feedback.create({
        customer_id: customer?.id || user?.customer_id,
        customer_name: customer?.name || 'Unknown',
        submitted_by: user?.email,
        submitted_by_name: user?.full_name,
        type,
        subject: subject.trim() || undefined,
        description: description.trim(),
        screenshot_urls: screenshots.length > 0 ? JSON.stringify(screenshots) : undefined,
        page_url: window.location.href,
        status: 'new'
      });

      toast.success('Thank you! Your feedback has been submitted.');
      handleClose();
      resetForm();
    } catch {
      toast.error('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = feedbackTypes.find(t => t.value === type);

  return (
    <>
      {/* Left-edge vertical tab */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed left-0 top-1/2 z-50",
          "flex items-center gap-1.5 px-2.5 py-1.5",
          "bg-primary hover:bg-primary/90 text-white text-xs font-semibold tracking-wide",
          "rounded-r-md shadow-md transition-all duration-200",
          "hover:shadow-lg hover:pl-3",
          open && "opacity-0 pointer-events-none"
        )}
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'translateY(-50%)' }}
        title="Send Feedback"
      >
        <MessageSquarePlus className="w-3.5 h-3.5" style={{ transform: 'rotate(90deg)' }} />
        Feedback
      </button>

      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Slide-in panel from left */}
      <div
        ref={panelRef}
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-[400px] max-w-[90vw]",
          "bg-white shadow-2xl flex flex-col",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        onPaste={handlePaste}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-[15px] font-semibold text-slate-900">Send Feedback</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Type pills */}
          <div className="flex gap-1.5">
            {feedbackTypes.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  type === t.value
                    ? t.activeClass
                    : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-600"
                )}
              >
                <t.icon className="w-3 h-3" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Subject */}
          <input
            type="text"
            placeholder="Subject (optional)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 transition-all"
          />

          {/* Description */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              placeholder="What's on your mind? Describe the issue, idea, or question..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 resize-none transition-all"
              rows={5}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Tip: Paste screenshots directly with Ctrl+V
            </p>
          </div>

          {/* Screenshots / Drop zone */}
          <div
            className={cn(
              "rounded-lg border-2 border-dashed transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-slate-200",
              screenshots.length === 0 && "py-5"
            )}
          >
            {screenshots.length > 0 ? (
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {screenshots.map((url, index) => (
                    <div key={index} className="relative group aspect-video rounded-md overflow-hidden bg-slate-100 border border-slate-200">
                      <img
                        src={url}
                        alt={`Screenshot ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                      <button
                        onClick={() => removeScreenshot(index)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
                  Add more
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex flex-col items-center gap-2 text-slate-400 hover:text-slate-500 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                    <Image className="w-4 h-4" />
                  </div>
                )}
                <div className="text-center">
                  <p className="text-xs font-medium text-slate-500">
                    Drop images here or <span className="text-primary">browse</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">PNG, JPG up to 10MB</p>
                </div>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={handleSubmit}
            disabled={submitting || !description.trim()}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
              "bg-primary hover:bg-primary/90 text-white shadow-sm",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Feedback
          </button>
        </div>
      </div>
    </>
  );
}
