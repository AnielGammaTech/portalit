import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageSquarePlus, X, Upload, Image, Bug, Lightbulb, HelpCircle, Send, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

const feedbackTypes = [
  { value: 'bug', label: 'Bug Report', icon: Bug, color: 'red' },
  { value: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'amber' },
  { value: 'question', label: 'Question', icon: HelpCircle, color: 'blue' },
  { value: 'other', label: 'Other', icon: MessageSquarePlus, color: 'slate' },
];

export default function FeedbackButton({ user, customer }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState('other');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    setUploading(true);
    try {
      const uploadPromises = files.map(file => base44.integrations.Core.UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const urls = results.map(r => r.file_url);
      setScreenshots(prev => [...prev, ...urls]);
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          setUploading(true);
          try {
            const result = await base44.integrations.Core.UploadFile({ file });
            setScreenshots(prev => [...prev, result.file_url]);
          } catch (error) {
            toast.error('Failed to upload pasted image');
          } finally {
            setUploading(false);
          }
        }
      }
    }
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
      await base44.entities.Feedback.create({
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

      toast.success('Feedback submitted! Thank you.');
      setOpen(false);
      setType('other');
      setSubject('');
      setDescription('');
      setScreenshots([]);
    } catch (error) {
      toast.error('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = feedbackTypes.find(t => t.value === type);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
        title="Send Feedback"
      >
        <MessageSquarePlus className="w-5 h-5" />
      </button>

      {/* Feedback Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" onPaste={handlePaste}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5 text-purple-600" />
              Send Feedback
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type Selection */}
            <div className="grid grid-cols-4 gap-2">
              {feedbackTypes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all text-xs",
                    type === t.value
                      ? t.color === 'red' ? "border-red-500 bg-red-50"
                        : t.color === 'amber' ? "border-amber-500 bg-amber-50"
                        : t.color === 'blue' ? "border-blue-500 bg-blue-50"
                        : "border-slate-500 bg-slate-50"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <t.icon className={cn(
                    "w-4 h-4",
                    type === t.value
                      ? t.color === 'red' ? "text-red-600"
                        : t.color === 'amber' ? "text-amber-600"
                        : t.color === 'blue' ? "text-blue-600"
                        : "text-slate-600"
                      : "text-slate-400"
                  )} />
                  <span className="text-slate-700">{t.label}</span>
                </button>
              ))}
            </div>

            {/* Subject */}
            <Input
              placeholder="Subject (optional)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />

            {/* Description */}
            <Textarea
              placeholder="Describe your feedback, issue, or question... (Tip: Paste screenshots directly!)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[120px]"
            />

            {/* Screenshots */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Screenshots</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-1"
                >
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  Upload
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {screenshots.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {screenshots.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Screenshot ${index + 1}`}
                        className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        onClick={() => removeScreenshot(index)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {screenshots.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  <Image className="w-4 h-4 inline mr-1" />
                  Paste or upload screenshots
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={submitting || !description.trim()}
              className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}