import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Upload,
  X,
  ImageIcon,
  ArrowRight,
  Sparkles,
  BrainCircuit,
  AlertCircle,
  CheckCircle2,
  Clock,
  Mic,
  MicOff,
  Loader2,
  Volume2,
  Globe,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import { translateText, SUPPORTED_LANGUAGES } from '../../services/translationService';
import TemplateSelector from '../components/TemplateSelector';
import TemplateForm from '../components/TemplateForm';
import TICKET_TEMPLATES, { serializeFieldsToText, getEmptyFormValues } from '../../data/ticketTemplates';
import { API_CONFIG } from '../../config';

const CreateTicket = () => {
    const [issue, setIssue] = useState('');
    const [ticketTitle, setTicketTitle] = useState('');
    const [file, setFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [extractedOCR, setExtractedOCR] = useState('');
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const isListeningRef = useRef(false);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const MAX_CHARS = 1000;
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB max file size
    const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];
    const supportsSpeech = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const [selectedLanguage, setSelectedLanguage] = useState('en');
    const [isTranslating, setIsTranslating] = useState(false);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const langRef = useRef(null);

    // ── Smart Template state (v2: two-step highlight → activate flow) ──
    const [highlightedTemplateId, setHighlightedTemplateId] = useState(null);  // Card highlighted (preview)
    const [activatedTemplateId, setActivatedTemplateId] = useState(null);      // Template committed (form shown)
    const [formValues, setFormValues] = useState({});                          // Dynamic form field values
    const [templateUsed, setTemplateUsed] = useState(false);
    const [userModified, setUserModified] = useState(false);

    // Voice UI states
    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState('');
    const [interimVoice, setInterimVoice] = useState('');
    const [usedVoice, setUsedVoice] = useState(false);

    const recognitionRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const dataArrayRef = useRef(null);
    const animationFrameRef = useRef(null);
    const [visualizerData, setVisualizerData] = useState(new Array(16).fill(15));
    const streamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const [recordingTime, setRecordingTime] = useState(120);
    const recordingTimerRef = useRef(null);
    const [isTranscribing, setIsTranscribing] = useState(false);

    useEffect(() => {
        return () => {
            isListeningRef.current = false;
            if (recognitionRef.current) recognitionRef.current.stop();
            if (audioContextRef.current) audioContextRef.current.close();
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);

    // Pre-select template if navigated from QuickActions or Dashboard with a templateId
    // v2: Now highlights the template so user sees the preview first
    useEffect(() => {
        const incomingTemplateId = location.state?.templateId;
        if (incomingTemplateId) {
            const template = TICKET_TEMPLATES.find((t) => t.id === incomingTemplateId);
            if (template) {
                handleHighlightTemplate(template);
            }
        }
    }, []);

    // Close language dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (langRef.current && !langRef.current.contains(event.target)) {
                setIsLangOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        return () => {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
        };
    }, [imagePreview]);

    const processOCR = async (imageFile) => {
        setIsOcrLoading(true);
        try {
            const { default: Tesseract } = await import('tesseract.js');
            const { data: { text } } = await Tesseract.recognize(imageFile, 'eng');
            setExtractedOCR(text.trim());
        } catch (err) {
            console.error("OCR Failed:", err);
        } finally {
            setIsOcrLoading(false);
        }
    };
  }, []);

  // Close language dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (langRef.current && !langRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

    const startListening = async () => {
        if (!supportsSpeech) {
            setError("Microphone is not supported in this browser.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContextRef.current = new AudioContext();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            const analyser = audioContextRef.current.createAnalyser();
            analyser.fftSize = 64;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyserRef.current = analyser;
            dataArrayRef.current = dataArray;
            source.connect(analyser);

            const updateVisualizer = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArrayRef.current);
                const bars = [];
                for (let i = 0; i < 16; i++) {
                    const val = dataArrayRef.current[i] || 0;
                    const height = Math.max(5, (val / 255) * 50);
                    bars.push(height);
                }
                setVisualizerData(bars);
                animationFrameRef.current = requestAnimationFrame(updateVisualizer);
            };
            updateVisualizer();

            // Setup MediaRecorder
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setIsTranscribing(true);
                try {
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'recording.webm');

                    const backendUrl = API_CONFIG.BACKEND_URL;
                    const res = await fetch(`${backendUrl}/api/voice/transcribe`, {
                        method: 'POST',
                        body: formData
                    });

                    if (!res.ok) throw new Error('Transcription failed');
                    const data = await res.json();

                    setVoiceTranscript(prev => {
                        const combined = prev + ' ' + (data.transcribed_text || '');
                        return combined.trim();
                    });
                } catch (err) {
                    console.error("Transcription Error:", err);
                    setError("Failed to transcribe audio.");
                } finally {
                    setIsTranscribing(false);
                }
            };

            mediaRecorder.start();
            setRecordingTime(120);
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev <= 1) {
                        stopListening();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            setIsListening(true);
            isListeningRef.current = true;
            setShowVoiceModal(true);
            setVoiceTranscript('');
            setInterimVoice('');
            setError('');

        } catch (err) {
            console.error("Microphone access denied:", err);
            setError("Could not access microphone. Please ensure permissions are granted.");
        }
    };
  }, [imagePreview]);

    const stopListening = () => {
        setIsListening(false);
        isListeningRef.current = false;

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const handleSaveVoice = () => {
        setIssue(prev => {
            const combined = prev + ' ' + voiceTranscript;
            return combined.trim().substring(0, MAX_CHARS);
        });
        setUsedVoice(true);
        setShowVoiceModal(false);
    };

      // Navigate to AI Processing workflow where the API will be called
      navigate('/ai-processing', {
        state: {
          text: textToSubmit,
          original_text: issue,
          original_language: selectedLanguage,
          image_base64: imageBase64,
          image_text: extractedOCRText,
        },
      });
    } catch (err) {
      console.error(err);
      setError('Failed to submit ticket. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-[#f6f8f7] pb-20'>
      <main className='pt-32 px-6'>
        <div className='w-full max-w-2xl mx-auto'>
          {/* Left Column: User Input */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className='w-full'
          >
            <Card className='border-none shadow-sm hover:shadow-md transition-shadow duration-300 rounded-3xl bg-white overflow-hidden h-full flex flex-col'>
              <CardHeader className='p-8 pb-4'>
                <div className='flex items-center gap-2 mb-2'>
                  <div className='p-1.5 bg-emerald-100 text-emerald-600 rounded-lg'>
                    <Sparkles size={18} className='fill-emerald-600' />
                  </div>
                  <span className='text-xs font-black text-gray-400 uppercase tracking-widest'>
                    Workspace
                  </span>
                </div>
                <CardTitle className='text-3xl font-bold text-gray-900 tracking-tight'>
                  Report a New Issue
                </CardTitle>
                <CardDescription className='text-base text-gray-500'>
                  Describe the problem and our AI will analyze it instantly.
                </CardDescription>
              </CardHeader>

              <CardContent className='p-8 pt-2 flex-grow flex flex-col'>
                <form onSubmit={handleAnalyze} className='space-y-6 flex-grow flex flex-col'>
                  {/* Description Textarea */}
                  <div className='space-y-2 flex-grow flex flex-col relative'>
                    <div className='flex items-center justify-between'>
                      <label className='text-sm font-bold text-gray-700'>Describe your issue</label>
                      <span
                        className={`text-xs font-semibold ${issue.length >= MAX_CHARS ? 'text-red-500' : 'text-gray-400'}`}
                      >
                        {issue.length} / {MAX_CHARS}
                      </span>
                    </div>

                    {/* Premium Language Selector */}
                    <div className='flex items-center gap-2'>
                      <label className='text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0'>
                        Language:
                      </label>
                      <div className='relative flex-1' ref={langRef}>
                        <button
                          type='button'
                          onClick={() => setIsLangOpen(!isLangOpen)}
                          className='w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 flex items-center justify-between hover:bg-white hover:border-emerald-200 transition-all shadow-sm group'
                        >
                          <span className='flex items-center gap-2'>
                            <Globe size={14} className='text-emerald-500' />
                            {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.label}
                          </span>
                          <motion.div
                            animate={{ rotate: isLangOpen ? 180 : 0 }}
                            className='text-gray-400 group-hover:text-emerald-500 transition-colors'
                          >
                            <ChevronDown size={16} />
                          </motion.div>
                        </button>

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const droppedFile = e.dataTransfer.files?.[0];
        if (!droppedFile) return;
        if (!ALLOWED_FILE_TYPES.includes(droppedFile.type)) {
            setError('Only PNG, JPG, and PDF files are allowed.');
            return;
        }
        if (droppedFile.size > MAX_FILE_SIZE) {
            setError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
            return;
        }
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setFile(droppedFile);
        setImagePreview(URL.createObjectURL(droppedFile));
        setError('');
        processOCR(droppedFile);
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;
        if (!ALLOWED_FILE_TYPES.includes(selectedFile.type)) {
            setError('Only PNG, JPG, and PDF files are allowed.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        if (selectedFile.size > MAX_FILE_SIZE) {
            setError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setFile(selectedFile);
        setImagePreview(URL.createObjectURL(selectedFile));
        setError('');
        processOCR(selectedFile);
    };

    // ── Smart Template handlers (v2: highlight → activate → dismiss) ──

    /** Step 1: Highlight a template card (shows preview, does NOT apply) */
    const handleHighlightTemplate = (template) => {
        setHighlightedTemplateId(template ? template.id : null);
        setError('');
    };

    /** Step 2: User explicitly confirms — activate template and show dynamic form */
    const handleActivateTemplate = (template) => {
        setActivatedTemplateId(template.id);
        setHighlightedTemplateId(null);
        setTicketTitle(template.title);
        setFormValues(getEmptyFormValues(template.fields));
        setIssue('');  // Clear manual textarea content
        setTemplateUsed(true);
        setUserModified(false);
        setError('');
    };

    /** Dismiss: clear template and restore manual mode */
    const handleDismissTemplate = () => {
        setActivatedTemplateId(null);
        setHighlightedTemplateId(null);
        setTicketTitle('');
        setIssue('');
        setFormValues({});
        setTemplateUsed(false);
        setUserModified(false);
    };

    /** Handle individual field changes in the dynamic form */
    const handleFormFieldChange = (key, value) => {
        setFormValues((prev) => ({ ...prev, [key]: value }));
        if (templateUsed) setUserModified(true);
    };

    const handleAnalyze = async (e) => {
        e.preventDefault();

        // ── v2: Determine description text based on active mode ──
        const activeTemplate = TICKET_TEMPLATES.find((t) => t.id === activatedTemplateId);
        let descriptionText = issue; // Default: manual textarea content

        if (activeTemplate) {
            // Template mode: serialize structured form fields to text
            descriptionText = serializeFieldsToText(activeTemplate.fields, formValues);

            // Validate required fields
            const missingFields = activeTemplate.fields
                .filter((f) => f.required && !formValues[f.key] && formValues[f.key] !== false)
                .map((f) => f.label);
            if (missingFields.length > 0) {
                setError(`Please fill in required fields: ${missingFields.join(', ')}`);
                return;
            }
        } else {
            // Manual mode: validate textarea
            if (!issue.trim()) {
                setError('Please describe your issue first.');
                return;
            }
        }

        if (file && !isOcrLoading && !extractedOCR.trim()) {
            setError('No text could be extracted from the image. Please upload a clear screenshot containing text, or remove the image to continue.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            let textToSubmit = descriptionText;

            if (selectedLanguage !== 'en') {
                setIsTranslating(true);
                textToSubmit = await translateText(descriptionText, selectedLanguage, 'en');
                setIsTranslating(false);
            }

            // If a title was provided, prepend it to the text for richer AI context
            if (ticketTitle.trim()) {
                textToSubmit = `${ticketTitle.trim()}\n\n${textToSubmit}`;
            }

            let imageBase64 = "";
            let extractedOCRText = extractedOCR;
            if (file) {
                imageBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        resolve(reader.result);
                    };
                    reader.readAsDataURL(file);
                });
            }

            navigate('/ai-processing', {
                state: {
                    text: textToSubmit,
                    original_text: descriptionText,
                    original_language: selectedLanguage,
                    image_base64: imageBase64,
                    image_text: extractedOCRText,
                    // Smart Template metadata
                    template_id: activatedTemplateId || null,
                    template_used: templateUsed,
                    user_modified: userModified,
                    ticket_title: ticketTitle.trim() || null,
                    source: usedVoice ? "voice" : "text",
                }
            });

        } catch (err) {
            console.error(err);
            setError('Failed to submit ticket. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 pb-20 relative overflow-hidden font-sans">
            {/* Ambient Background Matrix */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.02]"
                style={{ backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '24px 24px' }} />

            <main className="pt-32 px-4 sm:px-6 relative z-10">
                <div className="w-full max-w-2xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full text-left"
                    >
                        <Card className="rounded-[2.5rem] border border-white/[0.08] dark:border-slate-800 bg-white/[0.02] dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-2xl flex flex-col">
                            <CardHeader className="p-6 sm:p-8 pb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                                        <Sparkles size={16} />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-0.5">Workspace Node</span>
                                </div>
                                <CardTitle className="text-2xl sm:text-3xl font-black text-white dark:text-white tracking-tight font-syne uppercase">Report a New Issue</CardTitle>
                                <CardDescription className="text-sm sm:text-base text-slate-400 dark:text-slate-400 font-medium leading-relaxed">
                                    Describe the boundary exceptions and the automated heuristic pipeline will execute real-time triage.
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="p-6 sm:p-8 pt-2 flex-grow flex flex-col">
                                <form onSubmit={handleAnalyze} className="space-y-6 flex-grow flex flex-col">

                                    {/* Smart Ticket Templates Selection */}
                                    <TemplateSelector
                                        selectedTemplateId={highlightedTemplateId}
                                        activatedTemplateId={activatedTemplateId}
                                        onHighlightTemplate={handleHighlightTemplate}
                                        onActivateTemplate={handleActivateTemplate}
                                        onDismissTemplate={handleDismissTemplate}
                                        hasExistingContent={!!(issue.trim() || ticketTitle.trim())}
                                    />

                                    {/* Title Field */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-400 dark:text-slate-300">Title</label>
                                        <input
                                            type="text"
                                            value={ticketTitle}
                                            onChange={(e) => {
                                                setTicketTitle(e.target.value);
                                                if (templateUsed) setUserModified(true);
                                            }}
                                            placeholder="Brief summary of your issue"
                                            className="w-full rounded-2xl border border-white/10 bg-white/[0.01] dark:bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-base p-4"
                                            disabled={isLoading}
                                            maxLength={200}
                                        />
                                    </div>

                                    {/* Structured Template Form OR Manual Entry Pipeline */}
                                    {activatedTemplateId ? (
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-gray-400 dark:text-slate-300">Fill in the details</label>
                                            <TemplateForm
                                                fields={TICKET_TEMPLATES.find(t => t.id === activatedTemplateId)?.fields || []}
                                                values={formValues}
                                                onChange={handleFormFieldChange}
                                                disabled={isLoading}
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-2 flex-grow flex flex-col relative">
                                            <div className="flex items-center justify-between">
                                                <label className="text-sm font-bold text-gray-400 dark:text-slate-300">Describe your issue</label>
                                                <span className={`text-xs font-semibold ${issue.length >= MAX_CHARS ? 'text-rose-500' : 'text-gray-500'}`}>
                                                    {issue.length} / {MAX_CHARS}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3 bg-white/[0.01] dark:bg-slate-950 border border-white/5 dark:border-slate-800 p-3 rounded-2xl">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0 ml-1">Payload Language:</label>
                                                <div className="relative flex-1" ref={langRef}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsLangOpen(!isLangOpen)}
                                                        className="w-full bg-white/[0.02] border border-white/10 dark:border-slate-800 rounded-xl px-4 h-11 text-xs font-black uppercase tracking-wider text-slate-300 flex items-center justify-between hover:border-emerald-500/30 transition-all shadow-inner group cursor-pointer"
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <Globe size={14} className="text-emerald-400" />
                                                            {SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.label}
                                                        </span>
                                                        <motion.div
                                                            animate={{ rotate: isLangOpen ? 180 : 0 }}
                                                            className="text-slate-500 group-hover:text-emerald-400 transition-colors"
                                                        >
                                                            <ChevronDown size={14} />
                                                        </motion.div>
                                                    </button>

                                                    <AnimatePresence>
                                                        {isLangOpen && (
                                                            <motion.div
                                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                                animate={{ opacity: 1, y: 5, scale: 1 }}
                                                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                                className="absolute z-50 top-full left-0 right-0 bg-slate-950 border border-white/10 dark:border-slate-800 rounded-2xl shadow-2xl p-2 overflow-hidden text-left"
                                                            >
                                                                <div className="max-h-[200px] overflow-y-auto customize-scrollbar space-y-1">
                                                                    {SUPPORTED_LANGUAGES.map(lang => (
                                                                        <button
                                                                            key={lang.code}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSelectedLanguage(lang.code);
                                                                                setIsLangOpen(false);
                                                                            }}
                                                                            className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-between border-none bg-transparent cursor-pointer
                                                                    ${selectedLanguage === lang.code
                                                                                    ? 'bg-emerald-500/10 text-emerald-400'
                                                                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                                                                }`}
                                                                        >
                                                                            <span>{lang.label}</span>
                                                                            {selectedLanguage === lang.code && <CheckCircle2 size={14} className="text-emerald-400" />}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>

                                                {selectedLanguage !== 'en' && (
                                                    <motion.span
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="text-[9px] bg-emerald-500 text-slate-950 px-2.5 h-6 rounded-full font-black uppercase tracking-widest flex items-center shadow-lg shadow-emerald-500/10"
                                                    >
                                                        Translating
                                                    </motion.span>
                                                )}
                                            </div>

                                            <div className="relative flex-grow flex flex-col">
                                                <Textarea
                                                    value={issue}
                                                    onChange={(e) => setIssue(e.target.value.substring(0, MAX_CHARS))}
                                                    placeholder="Describe transaction anomalies or layout constraints. Example: LDAP verification timeout block error code 503."
                                                    className="min-h-[160px] flex-grow rounded-2xl border-white/10 bg-white/[0.01] text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm p-4 resize-none leading-relaxed font-medium shadow-inner"
                                                    disabled={isLoading}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Speech Synthesis Telemetry */}
                                    {supportsSpeech && (
                                        <div className="relative overflow-hidden rounded-3xl border border-white/[0.05] bg-white/[0.01] p-5 shadow-inner">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex gap-3.5 text-left items-center">
                                                    <div className={`p-2.5 rounded-xl transition-colors duration-500 ${isListening ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
                                                        <Mic size={18} className={isListening ? "animate-pulse" : ""} />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <h4 className="text-sm font-extrabold text-white font-syne uppercase tracking-wider m-0">Voice Input Matrix</h4>
                                                        <p className="text-xs text-slate-500 font-medium m-0">{isListening ? "Streaming real-time audio..." : "Describe parameters via speech"}</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    onClick={toggleMic}
                                                    className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all duration-500 border-none shrink-0 cursor-pointer
                                            ${isListening
                                                            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/10'
                                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/10'
                                                        }`}
                                                >
                                                    {isListening ? <Volume2 className="animate-bounce text-white" size={18} /> : <Mic size={18} />}
                                                </Button>
                                            </div>

                                            <AnimatePresence>
                                                {isListening && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 32 }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="flex items-center justify-center gap-1 mt-4 overflow-hidden"
                                                    >
                                                        {[...Array(12)].map((_, i) => (
                                                            <motion.div
                                                                key={i}
                                                                animate={{
                                                                    height: [8, 24, 8],
                                                                    backgroundColor: ['#10b981', '#3b82f6', '#10b981']
                                                                }}
                                                                transition={{
                                                                    duration: 0.8,
                                                                    repeat: Infinity,
                                                                    delay: i * 0.05,
                                                                    ease: "easeInOut"
                                                                }}
                                                                className="w-1 rounded-full bg-emerald-500"
                                                            />
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}

                                    {/* Dropzone Attachment Bounding Area */}
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-0.5">Telemetry Frame Attachment</label>

                                        <AnimatePresence mode="wait">
                                            {!imagePreview ? (
                                                <motion.div
                                                    key="dropzone"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    onDragOver={handleDragOver}
                                                    onDrop={handleDrop}
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="group relative h-36 border-2 border-dashed border-white/10 rounded-3xl bg-white/[0.01] hover:bg-emerald-500/[0.02] hover:border-emerald-500/30 transition-all cursor-pointer flex flex-col items-center justify-center p-6 text-center shadow-inner"
                                                >
                                                    <input
                                                        type="file"
                                                        ref={fileInputRef}
                                                        onChange={handleFileChange}
                                                        accept="image/png, image/jpeg, application/pdf"
                                                        className="hidden"
                                                    />
                                                    <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-md">
                                                        <Upload className="text-emerald-400" size={16} />
                                                    </div>
                                                    <p className="text-sm font-extrabold text-slate-300 font-syne uppercase tracking-wider m-0">Uplink System Screenshot</p>
                                                    <p className="text-xs text-slate-500 font-medium mt-1 m-0">PNG, JPG, or PDF up to 5MB</p>
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    key="preview"
                                                    initial={{ opacity: 0, scale: 0.98 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.98 }}
                                                    className="relative rounded-3xl border border-white/10 bg-white/[0.02] p-4 items-center flex gap-4 text-left shadow-2xl"
                                                >
                                                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/5 shadow-inner shrink-0 bg-black">
                                                        <img src={imagePreview} alt="Attached vector mapping payload" className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 space-y-0.5">
                                                        <p className="text-sm font-bold text-white truncate m-0">{file?.name}</p>
                                                        <p className="text-xs font-medium text-slate-400 m-0">
                                                            {(file?.size / 1024 / 1024).toFixed(2)} MB
                                                            {isOcrLoading && " • Executing OCR Text Extraction..."}
                                                            {!isOcrLoading && extractedOCR && " • OCR ingestion token mapped"}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={removeFile}
                                                        className="text-slate-500 hover:text-rose-400 hover:bg-white/5 rounded-full shrink-0 h-9 w-9 p-0 bg-transparent border-none cursor-pointer"
                                                    >
                                                        <X size={16} />
                                                    </Button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* System Warning Log Interface */}
                                    <AnimatePresence mode="wait">
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5 text-rose-400 text-xs font-bold uppercase tracking-wide leading-snug overflow-hidden text-left"
                                            >
                                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                                <p className="m-0">{error}</p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Submission Controls */}
                                    <Button
                                        type="submit"
                                        disabled={isLoading || isOcrLoading || isTranslating || !issue.trim()}
                                        className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/10 active:scale-[0.99] transition-all border-none cursor-pointer uppercase tracking-wider disabled:opacity-20"
                                    >
                                        {(isLoading || isTranslating) ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>{isTranslating ? 'Executing translation mapping...' : 'Transmitting core payload...'}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Deploy Pipeline Triage</span>
                                                <ArrowRight size={16} />
                                            </>
                                        )}
                                    </Button>

                                    <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600 select-none">
                                        <BrainCircuit size={14} />
                                        <span>Autonomous HelpDesk.ai Core Optimization Engine</span>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </main>

            {/* Modal dictation module overlay layer view */}
            <AnimatePresence>
                {showVoiceModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.98, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.98, opacity: 0, y: 15 }}
                            className="w-full max-w-lg bg-slate-950 border border-white/[0.08] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col text-left"
                        >
                            <div className="p-6 bg-white/[0.01] border-b border-white/[0.05] flex items-center justify-between">
                                <div className="flex items-center gap-3.5">
                                    <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                        {isListening && (
                                            <span className="absolute inset-0 rounded-xl border-2 border-emerald-500/30 animate-ping" />
                                        )}
                                        <Mic size={18} className={isListening ? "animate-pulse" : ""} />
                                    </div>
                                    <div className="space-y-0.5">
                                        <h3 className="font-extrabold text-white text-base font-syne uppercase tracking-wider m-0">Live Dictation Stream</h3>
                                        <p className="text-xs text-emerald-400 font-black uppercase tracking-widest m-0">{isListening ? "Active Channel" : "Stream Bypassed"}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCancelVoice}
                                    className="p-2 text-slate-500 hover:bg-white/5 hover:text-white rounded-full transition-all border-none bg-transparent cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                  {/* Premium Voice Visualizer */}
                  {supportsSpeech && (
                    <div className='relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-6 shadow-sm'>
                      <div className='flex items-center justify-between mb-4'>
                        <div className='flex items-center gap-3'>
                          <div
                            className={`p-2 rounded-xl transition-colors duration-500 ${isListening ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-emerald-100 text-emerald-600'}`}
                          >
                            <Mic size={20} className={isListening ? 'animate-pulse' : ''} />
                          </div>
                          <div>
                            <h4 className='text-sm font-bold text-gray-900'>Voice Assistant</h4>
                            <p className='text-xs text-gray-500 font-medium'>
                              {isListening
                                ? 'Listening to your voice...'
                                : 'Tap to describe via voice'}
                            </p>
                          </div>
                        </div>
                        <Button
                          type='button'
                          onClick={toggleMic}
                          className={`h-12 w-12 rounded-full flex items-center justify-center transition-all duration-500 border-none
                                                        ${
                                                          isListening
                                                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200 scale-110'
                                                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                                                        }`}
                        >
                          {isListening ? (
                            <Volume2 className='animate-bounce' size={24} />
                          ) : (
                            <Mic size={24} />
                          )}
                        </Button>
                      </div>

                      {/* Siri-style Wave Animation */}
                      <AnimatePresence>
                        {isListening && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 40 }}
                            exit={{ opacity: 0, height: 0 }}
                            className='flex items-center justify-center gap-1.5 mb-2 overflow-hidden'
                          >
                            {[...Array(12)].map((_, i) => (
                              <motion.div
                                key={i}
                                animate={{
                                  height: [10, 30, 10],
                                  backgroundColor: ['#10b981', '#3b82f6', '#10b981'],
                                }}
                                transition={{
                                  duration: 0.8,
                                  repeat: Infinity,
                                  delay: i * 0.05,
                                  ease: 'easeInOut',
                                }}
                                className='w-1 rounded-full bg-emerald-500'
                              />
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>

                            <div className="p-5 bg-white/[0.01] flex gap-4 border-t border-white/[0.05]">
                                <Button
                                    type="button"
                                    onClick={handleCancelVoice}
                                    className="flex-1 h-12 border border-white/10 text-slate-400 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-white/5 transition-all cursor-pointer bg-transparent"
                                >
                                    Cancel
                                </Button>
                                {isListening ? (
                                    <Button
                                        type="button"
                                        onClick={stopListening}
                                        className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold h-12 rounded-xl shadow-lg shadow-red-200"
                                    >
                                        Stop Recording
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        onClick={handleSaveVoice}
                                        disabled={!voiceTranscript && !isTranscribing}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center"
                                    >
                                        {isTranscribing ? <><Loader2 className="animate-spin mr-2" size={18} /> Transcribing...</> : "Insert Text"}
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* Screenshot Upload */}
                  <div className='space-y-2'>
                    <label className='text-sm font-bold text-gray-700'>Screenshot (Optional)</label>

                    <AnimatePresence mode='wait'>
                      {!imagePreview ? (
                        <motion.div
                          key='dropzone'
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className='group relative h-40 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50 hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer flex flex-col items-center justify-center p-6'
                        >
                          <input
                            type='file'
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept='image/png, image/jpeg, application/pdf'
                            className='hidden'
                          />
                          <div className='w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform'>
                            <Upload className='text-emerald-500' size={20} />
                          </div>
                          <p className='text-sm font-semibold text-gray-600'>
                            Drag and drop or click to upload
                          </p>
                          <p className='text-xs text-gray-400 mt-1'>PNG, JPG, or PDF up to 5MB</p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key='preview'
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className='relative rounded-2xl border border-gray-100 overflow-hidden bg-white p-4 items-center flex'
                        >
                          <div className='flex items-center gap-4 w-full'>
                            <div className='w-20 h-20 rounded-xl overflow-hidden border border-gray-50 shadow-inner shrink-0'>
                              <img
                                src={imagePreview}
                                alt='Preview'
                                className='w-full h-full object-cover'
                              />
                            </div>
                            <div className='flex-1 min-w-0'>
                              <p className='text-sm font-bold text-gray-900 truncate'>
                                {file?.name}
                              </p>
                              <p className='text-sm font-medium text-gray-600 mt-1'>
                                {(file?.size / 1024 / 1024).toFixed(2)} MB
                                {isOcrLoading && ' • Extracting text...'}
                                {!isOcrLoading && extractedOCR && ' • Text extracted'}
                              </p>
                            </div>
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              onClick={removeFile}
                              className='text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full shrink-0'
                            >
                              <X size={18} />
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className='p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm font-medium'>
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}

                  {/* Primary Submit Button */}
                  <Button
                    type='submit'
                    disabled={isLoading || isOcrLoading || isTranslating || !issue.trim()}
                    className='w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg rounded-2xl flex items-center justify-center gap-2 transition-all border-none shadow-emerald-200/50 shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-50'
                  >
                    {isLoading || isTranslating ? (
                      <>
                        <div className='w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin' />
                        {isTranslating ? 'Translating...' : 'Submitting issue...'}
                      </>
                    ) : (
                      <>
                        Submit Ticket
                        <ArrowRight size={20} />
                      </>
                    )}
                  </Button>
                  <div className='flex items-center justify-center gap-2 text-xs text-gray-400 font-medium'>
                    <BrainCircuit size={14} />
                    Powered by HelpDesk.ai Routing
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      {/* Premium Voice Modal Overlay */}
      <AnimatePresence>
        {showVoiceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className='w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col'
            >
              <div className='p-6 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='relative flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-600'>
                    {isListening && (
                      <span className='absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping'></span>
                    )}
                    <Mic size={20} className={isListening ? 'animate-pulse' : ''} />
                  </div>
                  <div>
                    <h3 className='font-bold text-gray-900 leading-tight'>Live Dictation</h3>
                    <p className='text-xs text-emerald-600 font-medium'>
                      {isListening ? 'Listening...' : 'Paused'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCancelVoice}
                  className='p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors'
                >
                  <X size={20} />
                </button>
              </div>

              <div className='p-8 min-h-[200px] max-h-[300px] overflow-y-auto relative'>
                <p className='text-gray-800 text-lg leading-relaxed font-medium'>
                  {voiceTranscript}
                  <span className='text-gray-400'> {interimVoice}</span>
                  {isListening && (
                    <span className='inline-block w-2 h-5 ml-1 align-middle bg-emerald-400 animate-pulse'></span>
                  )}
                </p>
                {!voiceTranscript && !interimVoice && (
                  <div className='h-full flex items-center justify-center text-gray-400 text-sm font-medium italic'>
                    Start speaking... we're listening.
                  </div>
                )}
              </div>

              {/* Siri-style Wave Animation */}
              <AnimatePresence>
                {isListening && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 60 }}
                    exit={{ opacity: 0, height: 0 }}
                    className='flex items-center justify-center gap-1.5 overflow-hidden bg-gray-50 border-t border-gray-100'
                  >
                    {[...Array(16)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          height: visualizerData[i] || 15,
                          backgroundColor: (visualizerData[i] || 15) > 30 ? '#10b981' : '#34d399',
                        }}
                        transition={{
                          type: 'spring',
                          stiffness: 300,
                          damping: 20,
                        }}
                        className='w-1.5 rounded-full bg-emerald-400'
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className='p-6 bg-gray-50 flex gap-4 border-t border-gray-100'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={handleCancelVoice}
                  className='flex-1 font-bold text-gray-600 border-gray-200 hover:bg-white h-12 rounded-xl'
                >
                  Cancel
                </Button>
                <Button
                  type='button'
                  onClick={handleSaveVoice}
                  disabled={!voiceTranscript && !interimVoice}
                  className='flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-emerald-200'
                >
                  Insert Text
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CreateTicket;

