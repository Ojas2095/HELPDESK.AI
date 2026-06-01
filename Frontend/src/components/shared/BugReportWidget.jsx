import React, { useState, useEffect } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Bug,
  X,
  Info,
  Send,
  AlertTriangle,
  ScreenShare,
  ShieldAlert,
  Camera,
  Trash2,
  Crop,
  MousePointer2,
  ChevronDown,
  Check,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { supabase } from '../../lib/supabaseClient';
import useAuthStore from '../../store/authStore';
import useToastStore from '../../store/toastStore';
import { API_CONFIG } from '../../config';

function useDiagnostics() {
  const [diagnostics, setDiagnostics] = useState({
    url: '',
    browser: '',
    screen: '',
    consoleErrors: [],
    networkErrors: [],
  });

  useEffect(() => {
    // Collect static info
    const browserInfo = navigator.userAgent;
    const screenInfo = `${window.innerWidth}x${window.innerHeight}`;

        setDiagnostics(prev => ({
            ...prev,
            url: window.location.href,
            browser: browserInfo,
            screen: screenInfo
        }));

<<<<<<< HEAD
        const originalConsoleError = console.error;
        console.error = function (...args) {
            setDiagnostics(prev => ({
                ...prev,
                consoleErrors: [...prev.consoleErrors, args.join(' ')].slice(-10)
            }));
            originalConsoleError.apply(console, args);
        };

=======
        // Global Error Listener
>>>>>>> upstream/gssoc
        const handleError = (e) => {
            setDiagnostics(prev => ({
                ...prev,
                consoleErrors: [...prev.consoleErrors, `Uncaught: ${e.message}`].slice(-10)
            }));
        };
        window.addEventListener('error', handleError);

        return () => {
            window.removeEventListener('error', handleError);
        };
    }, []);

    const refreshUrl = () => {
        setDiagnostics(prev => ({ ...prev, url: window.location.href }));
    };

    // Global Error Listener
    const handleError = (e) => {
      setDiagnostics((prev) => ({
        ...prev,
        consoleErrors: [...prev.consoleErrors, `Uncaught: ${e.message}`].slice(-10),
      }));
    };
    window.addEventListener('error', handleError);

    return () => {
      console.error = originalConsoleError;
      window.removeEventListener('error', handleError);
    };
  }, []);

  // Refresh URL right before opening modal
  const refreshUrl = () => {
    setDiagnostics((prev) => ({ ...prev, url: window.location.href }));
  };

  return { diagnostics, refreshUrl };
}

const CustomSelect = ({ label, value, options, onChange, name }) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className='relative'>
      <label className='block text-sm font-semibold text-slate-700 mb-1.5'>{label}</label>
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        className='w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-[#13ec80] transition-all text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#13ec80]/20'
      >
        <span className='truncate'>{selectedOption.label}</span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className='fixed inset-0 z-[60]' onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className='absolute z-[70] w-full mt-2 py-1 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden'
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type='button'
                  onClick={() => {
                    onChange({ target: { name, value: option.value } });
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors
                                        ${
                                          value === option.value
                                            ? 'bg-[#13ec80]/10 text-slate-900 font-semibold'
                                            : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                >
                  {option.label}
                  {value === option.value && <Check className='w-4 h-4 text-[#13ec80]' />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const BugReportWidget = ({ advanced = false, customTrigger = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuthStore();
  const { showToast: addToast } = useToastStore();
  const { diagnostics, refreshUrl } = useDiagnostics();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const [screenshotData, setScreenshotData] = useState(null);
  const [, setIsCapturing] = useState(false);
  const [isSelectingRegion, setIsSelectingRegion] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionRect, setSelectionRect] = useState(null);

  const [formData, setFormData] = useState({
    bug_title: '',
    description: '',
    steps_to_reproduce: '',
    expected_result: '',
    actual_result: '',
    severity: 'Medium',
    category: 'Functionality Broken',
    contact_permission: false,
  });

  const [showScrollToTop, setShowScrollToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const threshold = Math.min(window.innerWidth, window.innerHeight || 400);
      setShowScrollToTop(window.scrollY > threshold);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleOpen = () => {
    if (!isOpen) {
      refreshUrl();
      setIsOpen(true);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    // Reset specific form fields, but keep severity/category
    setFormData((prev) => ({
      ...prev,
      bug_title: '',
      description: '',
      steps_to_reproduce: '',
      expected_result: '',
      actual_result: '',
    }));
    setScreenshotData(null);
  };

  const handleCaptureScreenshot = () => {
    // Step 1: Hide modal and enter selection mode
    setIsOpen(false);
    setSelectionRect(null);
    setSelectionStart(null);

    // Wait for modal animation to clear
    setTimeout(() => {
      setIsSelectingRegion(true);
      addToast('Click and drag over the dashboard to select the bug area.', 'info');
    }, 500);
  };

  const handleMouseDown = (e) => {
    if (!isSelectingRegion) return;
    setSelectionStart({ x: e.clientX, y: e.clientY });
    setSelectionRect({ left: e.clientX, top: e.clientY, width: 0, height: 0 });
  };

  const handleMouseMove = (e) => {
    if (!isSelectingRegion || !selectionStart) return;

    const left = Math.min(e.clientX, selectionStart.x);
    const top = Math.min(e.clientY, selectionStart.y);
    const width = Math.abs(e.clientX - selectionStart.x);
    const height = Math.abs(e.clientY - selectionStart.y);

    setSelectionRect({ left, top, width, height });
  };

  const handleMouseUp = async () => {
    if (!isSelectingRegion || !selectionRect || selectionRect.width < 10) {
      setSelectionStart(null);
      setSelectionRect(null);
      return;
    }

    setIsSelectingRegion(false);
    setIsCapturing(true);

    // Snap the region
    try {
      const { left, top, width, height } = selectionRect;

      // html2canvas options for partial capture
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        x: left + window.scrollX,
        y: top + window.scrollY,
        width: width,
        height: height,
        scale: 2, // High quality
      });

      const base64Image = canvas.toDataURL('image/jpeg', 0.8);
      setScreenshotData(base64Image);
      addToast('Region captured successfully!', 'success');
    } catch (err) {
      console.error('Capture failed:', err);
      addToast('Failed to capture region.', 'error');
    } finally {
      setIsCapturing(false);
      setIsOpen(true);
      setSelectionStart(null);
      setSelectionRect(null);
    }
  };

  const handleCancelSelection = () => {
    setIsSelectingRegion(false);
    setIsOpen(true);
    setSelectionStart(null);
    setSelectionRect(null);
  };

  const handleClearScreenshot = () => {
    setScreenshotData(null);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isSelectingRegion) {
        handleCancelSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelectingRegion]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 10 second throttle
    const now = Date.now();
    if (now - lastSubmitTime < 10000) {
      addToast('Please wait before submitting another report.', 'error');
      return;
    }

    const actualTitle = advanced
      ? formData.bug_title
      : formData.description
        ? formData.description.slice(0, 40) + '...'
        : '';

    if (!actualTitle || !formData.description) {
      addToast(
        advanced
          ? 'Please fill out the Title and Description fields.'
          : 'Please describe what happened.',
        'error'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Call AI Diagnostics
      let probableCause = 'Not analyzed';
      try {
        // Using standard fetch assuming backend is on port 8000
        const aiResponse = await fetch(`${API_CONFIG.BACKEND_URL}/ai/analyze_bug`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bug_title: formData.bug_title,
            description: formData.description,
            steps_to_reproduce: formData.steps_to_reproduce,
            console_errors: diagnostics.consoleErrors,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          if (aiData.probable_cause) {
            probableCause = aiData.probable_cause;
          }
        }
      } catch (aiErr) {
        console.error('AI Analysis failed silently:', aiErr);
      }

      // 2. Prepare payload
      const payload = {
        user_id: user ? user.id : null,
        bug_title: actualTitle,
        description: formData.description,
        steps_to_reproduce: formData.steps_to_reproduce,
        expected_result: formData.expected_result,
        actual_result: formData.actual_result,
        severity: formData.severity,
        category: formData.category,
        contact_permission: formData.contact_permission,
        diagnostic_data: {
          url: diagnostics.url,
          browser: diagnostics.browser,
          screen: diagnostics.screen,
          console_errors: diagnostics.consoleErrors,
          network_errors: diagnostics.networkErrors,
          screenshot_base64: screenshotData, // Attached light-weight jpeg data
          ai_probable_cause: probableCause, // Added AI Root Cause Analysis
          timestamp: new Date().toISOString(),
        },
      };

      const { error } = await supabase.from('bug_reports').insert([payload]);

      if (error) {
        console.error('Supabase Error:', error);

    const handleMouseDown = (e) => {
        if (!isSelectingRegion) return;
        setSelectionStart({ x: e.clientX, y: e.clientY });
        setSelectionRect({ left: e.clientX, top: e.clientY, width: 0, height: 0 });
    };

    const handleMouseMove = (e) => {
        if (!isSelectingRegion || !selectionStart) return;

        const left = Math.min(e.clientX, selectionStart.x);
        const top = Math.min(e.clientY, selectionStart.y);
        const width = Math.abs(e.clientX - selectionStart.x);
        const height = Math.abs(e.clientY - selectionStart.y);

        setSelectionRect({ left, top, width, height });
    };

    const handleMouseUp = async () => {
        if (!isSelectingRegion || !selectionRect || selectionRect.width < 10) {
            setSelectionStart(null);
            setSelectionRect(null);
            return;
        }

        setIsSelectingRegion(false);
        setIsCapturing(true);

        try {
            const { left, top, width, height } = selectionRect;

            const canvas = await html2canvas(document.body, {
                useCORS: true,
                allowTaint: false,
                backgroundColor: null,
                logging: false,
                x: left + window.scrollX,
                y: top + window.scrollY,
                width: width,
                height: height,
                scale: 2
            });

            const base64Image = canvas.toDataURL('image/jpeg', 0.8);
            setScreenshotData(base64Image);
            addToast("Region captured successfully!", "success");
        } catch (err) {
            console.error("Capture failed:", err);
            addToast("Failed to capture region.", "error");
        } finally {
            setIsCapturing(false);
            setIsOpen(true);
            setSelectionStart(null);
            setSelectionRect(null);
        }
    };

    const handleCancelSelection = () => {
        setIsSelectingRegion(false);
        setIsOpen(true);
        setSelectionStart(null);
        setSelectionRect(null);
    };

    const handleClearScreenshot = () => {
        setScreenshotData(null);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isSelectingRegion) {
                handleCancelSelection();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSelectingRegion]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const now = Date.now();
        if (now - lastSubmitTime < 10000) {
            addToast("Please wait before submitting another report.", "error");
            return;
        }

        const actualTitle = advanced ? formData.bug_title : (formData.description ? formData.description.slice(0, 40) + "..." : "");

        if (!actualTitle || !formData.description) {
            addToast(advanced ? "Please fill out the Title and Description fields." : "Please describe what happened.", "error");
            return;
        }

        setIsSubmitting(true);

        try {
            let probableCause = "Not analyzed";
            try {
                const aiResponse = await fetch(`${API_CONFIG.BACKEND_URL}/ai/analyze_bug`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        bug_title: formData.bug_title,
                        description: formData.description,
                        steps_to_reproduce: formData.steps_to_reproduce,
                        console_errors: diagnostics.consoleErrors
                    })
                });

                if (aiResponse.ok) {
                    const aiData = await aiResponse.json();
                    if (aiData.probable_cause) {
                        probableCause = aiData.probable_cause;
                    }
                }
            } catch (aiErr) {
                console.error("AI Analysis failed silently:", aiErr);
            }

            const payload = {
                user_id: user ? user.id : null,
                bug_title: actualTitle,
                description: formData.description,
                steps_to_reproduce: formData.steps_to_reproduce,
                expected_result: formData.expected_result,
                actual_result: formData.actual_result,
                severity: formData.severity,
                category: formData.category,
                contact_permission: formData.contact_permission,
                diagnostic_data: {
                    url: diagnostics.url,
                    browser: diagnostics.browser,
                    screen: diagnostics.screen,
                    console_errors: diagnostics.consoleErrors,
                    network_errors: diagnostics.networkErrors,
                    screenshot_base64: screenshotData,
                    ai_probable_cause: probableCause,
                    timestamp: new Date().toISOString()
                }
            };

            const { error } = await supabase
                .from('bug_reports')
                .insert([payload]);

            if (error) {
                if (error.code === '42P01') {
                    setTimeout(() => {
                        addToast("Diagnostic Report Sent (Mock). Please run the SQL script to persist to DB.", "success");
                        setLastSubmitTime(Date.now());
                        setIsSubmitting(false);
                        handleClose();
                    }, 1000);
                    return;
                }
                throw error;
            }

            addToast("Bug Report Sent. Our diagnostic engine is on it!", "success");
            setLastSubmitTime(Date.now());
            setIsSubmitting(false);
            handleClose();
          }, 1000);
          return;
        }
        throw error;
      }

      addToast('Bug Report Sent. Our diagnostic engine is on it!', 'success');
      setLastSubmitTime(Date.now());
      handleClose();
    } catch (error) {
      console.error('Error submitting bug:', error);
      addToast('Failed to submit bug. Please try again later.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {/* Trigger Button */}
      <AnimatePresence>
        {!isOpen && !customTrigger && (
          <motion.button
            initial={{ scale: 0.8, opacity: 0, x: 0 }}
            animate={{
              scale: 1,
              opacity: 1,
              x: showScrollToTop ? -56 : 0,
            }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOpen}
            className='fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gradient-to-r from-[#13ec80] to-[#0fd472] text-[#111814] px-4 py-3 rounded-full shadow-lg hover:shadow-xl hover:shadow-[#13ec80]/20 transition-all border border-[#13ec80]/50 group'
          >
            <Bug className='w-5 h-5 group-hover:rotate-12 transition-transform' />
            <span className='font-bold text-sm hidden sm:block'>Report Bug</span>
          </motion.button>
        )}
      </AnimatePresence>

      {customTrigger && !isOpen && (
        <div onClick={handleOpen} className='inline-block cursor-pointer'>
          {customTrigger}
        </div>
      )}

      {/* Modal Dialog */}
      <AnimatePresence>
        {isOpen && (
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto'>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className='fixed inset-0 bg-slate-900/40 backdrop-blur-sm'
            />

            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className='bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative z-50 my-auto border border-slate-100 flex flex-col max-h-[90vh]'
            >
              {/* Header */}
              <div className='flex items-center justify-between p-5 border-b border-slate-100 shrink-0'>
                <div className='flex items-center gap-3 text-[#13ec80]'>
                  <div className='p-2 bg-[#13ec80]/10 rounded-lg'>
                    <Bug className='w-6 h-6' />
                  </div>
                  <h2 className='text-xl font-bold text-slate-800'>Report a Bug</h2>
                </div>
                <button
                  onClick={handleClose}
                  className='p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className='p-6 overflow-y-auto customize-scrollbar'>
                {/* Info Box */}
                <div className='mb-6 bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-blue-800'>
                  <Info className='w-5 h-5 text-blue-500 shrink-0 mt-0.5' />
                  <div>
                    <p className='font-semibold mb-1 text-blue-900'>Auto-captured Diagnosis</p>
                    <p className='text-blue-700/90 leading-relaxed'>
                      Page URL, browser info, console errors, and screen dimensions are
                      automatically attached. You don't need to provide deep technical details—just
                      describe what you experienced.
                    </p>
                  </div>
                </div>

                <form id='bugReportForm' onSubmit={handleSubmit} className='space-y-5'>
                  {advanced && (
                    <div>
                      <label
                        className='block text-sm font-semibold text-slate-700 mb-1.5'
                        htmlFor='bug_title'
                      >
                        Bug Title <span className='text-red-500'>*</span>
                      </label>
                      <input
                        type='text'
                        id='bug_title'
                        name='bug_title'
                        required={advanced}
                        value={formData.bug_title}
                        onChange={handleChange}
                        placeholder='e.g., Evaluation fails to save after clicking submit'
                        className='w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#13ec80]/20 focus:border-[#13ec80] transition-all text-sm bg-slate-50 focus:bg-white'
                      />
                    </div>
                  )}

                  {/* What happened? */}
                  <div>
                    <label
                      className='block text-sm font-semibold text-slate-700 mb-1.5'
                      htmlFor='description'
                    >
                      What happened? <span className='text-red-500'>*</span>
                    </label>
                    <textarea
                      id='description'
                      name='description'
                      required
                      value={formData.description}
                      onChange={handleChange}
                      rows='3'
                      placeholder='Describe the bug in detail...'
                      className='w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#13ec80]/20 focus:border-[#13ec80] transition-all text-sm bg-slate-50 focus:bg-white resize-y'
                    ></textarea>
                  </div>

                  {advanced && (
                    <>
                      {/* Steps to Reproduce */}
                      <div>
                        <label
                          className='block text-sm font-semibold text-slate-700 mb-1.5'
                          htmlFor='steps_to_reproduce'
                        >
                          How can we reproduce this?{' '}
                          <span className='text-slate-400 font-normal text-xs ml-1'>
                            (Optional)
                          </span>
                        </label>
                        <textarea
                          id='steps_to_reproduce'
                          name='steps_to_reproduce'
                          value={formData.steps_to_reproduce}
                          onChange={handleChange}
                          rows='2'
                          placeholder='1. Go to...&#10;2. Click on...&#10;3. See error...'
                          className='w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#13ec80]/20 focus:border-[#13ec80] transition-all text-sm bg-slate-50 focus:bg-white resize-y'
                        ></textarea>
                      </div>

                      {/* Expected vs Actual */}
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                        <div>
                          <label
                            className='block text-sm font-semibold text-slate-700 mb-1.5'
                            htmlFor='expected_result'
                          >
                            What should happen?
                          </label>
                          <textarea
                            id='expected_result'
                            name='expected_result'
                            value={formData.expected_result}
                            onChange={handleChange}
                            rows='2'
                            placeholder='Expected result...'
                            className='w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#13ec80]/20 focus:border-[#13ec80] transition-all text-sm bg-slate-50 focus:bg-white resize-none'
                          ></textarea>
                        </div>
                        <div>
                          <label
                            className='block text-sm font-semibold text-slate-700 mb-1.5'
                            htmlFor='actual_result'
                          >
                            What actually happened?
                          </label>
                          <textarea
                            id='actual_result'
                            name='actual_result'
                            value={formData.actual_result}
                            onChange={handleChange}
                            rows='2'
                            placeholder='Actual result...'
                            className='w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#13ec80]/20 focus:border-[#13ec80] transition-all text-sm bg-slate-50 focus:bg-white resize-none'
                          ></textarea>
                        </div>
                      </div>

                      {/* Dropdowns */}
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                        <CustomSelect
                          label='Severity'
                          name='severity'
                          value={formData.severity}
                          onChange={handleChange}
                          options={[
                            { value: 'Low', label: 'Low - Cosmetic/Minor' },
                            { value: 'Medium', label: 'Medium - Affects functionality' },
                            { value: 'High', label: 'High - Major blocker' },
                            { value: 'Critical', label: 'Critical - System crash/Data loss' },
                          ]}
                        />
                        <CustomSelect
                          label='Bug Category'
                          name='category'
                          value={formData.category}
                          onChange={handleChange}
                          options={[
                            { value: 'UI Issue', label: 'UI Issue' },
                            { value: 'Functionality Broken', label: 'Functionality Broken' },
                            { value: 'Performance', label: 'Performance' },
                            { value: 'Security Issue', label: 'Security Issue' },
                            { value: 'Other', label: 'Other' },
                          ]}
                        />
                      </div>
                    </>
                  )}

                  {advanced && (
                    <>
                      {/* Permission */}
                      <label className='flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors mt-2'>
                        <input
                          type='checkbox'
                          name='contact_permission'
                          checked={formData.contact_permission}
                          onChange={handleChange}
                          className='w-4 h-4 text-[#13ec80] rounded border-slate-300 focus:ring-[#13ec80]'
                        />
                        <span className='text-sm font-medium text-slate-700'>
                          You can contact me for more information about this bug
                        </span>
                      </label>

                      {/* Diagnostics Read-Only View */}
                      <div className='mt-8 border border-slate-100 rounded-xl overflow-hidden text-xs'>
                        <div className='bg-slate-50 px-4 py-2.5 border-b border-slate-100 flex items-center gap-2'>
                          <ShieldAlert className='w-4 h-4 text-slate-500' />
                          <span className='font-semibold text-slate-600 tracking-wide uppercase'>
                            Captured Diagnostics
                          </span>
                        </div>
                        <div className='p-4 bg-white/50 space-y-2 font-mono text-slate-500'>
                          <div className='flex'>
                            <span className='w-24 shrink-0 text-slate-400'>Path:</span>{' '}
                            <span className='truncate'>
                              {diagnostics.url.split(window.location.host)[1] || diagnostics.url}
                            </span>
                          </div>
                          <div className='flex'>
                            <span className='w-24 shrink-0 text-slate-400'>Browser:</span>{' '}
                            <span className='truncate' title={diagnostics.browser}>
                              {diagnostics.browser.split(' ')[0]}{' '}
                              {
                                diagnostics.browser.split(' ')[
                                  diagnostics.browser.split(' ').length - 1
                                ]
                              }
                            </span>
                          </div>
                          <div className='flex'>
                            <span className='w-24 shrink-0 text-slate-400'>Screen:</span>{' '}
                            <span>{diagnostics.screen}</span>
                          </div>
                          <div className='flex'>
                            <span className='w-24 shrink-0 text-slate-400'>Errors:</span>{' '}
                            <span
                              className={
                                diagnostics.consoleErrors.length > 0
                                  ? 'text-amber-500 font-bold'
                                  : ''
                              }
                            >
                              {diagnostics.consoleErrors.length}
                            </span>
                          </div>
                          <div className='flex'>
                            <span className='w-24 shrink-0 text-slate-400'>Telemetry:</span>{' '}
                            <span className='text-emerald-500'>Active</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Action Attachments: Screenshot */}
                  {advanced && (
                    <div className='mt-6 border border-slate-200 rounded-xl p-4 bg-slate-50'>
                      <div className='flex items-center justify-between mb-3'>
                        <div>
                          <h3 className='text-sm font-semibold text-slate-800 flex items-center gap-2'>
                            <Camera className='w-4 h-4 text-[#13ec80]' />
                            Advanced Attachments
                          </h3>
                          <p className='text-xs text-slate-500 mt-1'>
                            Capture your screen to show exactly what's wrong.
                          </p>
                        </div>
                        {!screenshotData && (
                          <button
                            type='button'
                            onClick={handleCaptureScreenshot}
                            disabled={isSubmitting}
                            className='px-3 py-1.5 text-xs font-semibold text-[#111814] bg-[#13ec80] hover:bg-[#0fd472] transition-colors rounded-lg flex items-center gap-1.5 border border-[#13ec80]/20 shadow-sm'
                          >
                            <Crop className='w-3.5 h-3.5' />
                            Select Region & Snap
                          </button>
                        )}
                      </div>

                      <AnimatePresence>
                        {screenshotData && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className='relative mt-3 group rounded-lg overflow-hidden border border-slate-200'
                          >
                            <img
                              src={screenshotData}
                              alt='Captured screen'
                              className='w-full h-auto max-h-48 object-cover rounded-lg'
                            />
                            <div className='absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
                              <button
                                type='button'
                                onClick={handleClearScreenshot}
                                className='px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-red-600 transition-colors shadow-lg'
                              >
                                <Trash2 className='w-3.5 h-3.5' />
                                Remove
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </form>
              </div>

              {/* Footer */}
              <div className='p-5 border-t border-slate-100 bg-slate-50 rounded-b-2xl shrink-0 flex justify-end gap-3'>
                <button
                  type='button'
                  onClick={handleClose}
                  className='px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors rounded-xl'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  form='bugReportForm'
                  disabled={isSubmitting}
                  className='px-6 py-2.5 text-sm font-bold text-[#111814] bg-[#13ec80] hover:bg-[#0fd472] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded-xl shadow-lg shadow-[#13ec80]/30 flex items-center gap-2'
                >
                  {isSubmitting ? 'Sending...' : 'Submit Bug Report'}
                  {!isSubmitting && <Send className='w-4 h-4' />}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Region Selection Overlay */}
      <AnimatePresence>
        {isSelectingRegion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className='fixed inset-0 z-[9999] bg-slate-900/30 cursor-crosshair flex flex-col items-center justify-start pt-12'
          >
            <div className='bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-2xl border border-white/20 flex items-center gap-2 select-none pointer-events-none'>
              <MousePointer2 className='w-4 h-4 text-[#13ec80]' />
              <span className='text-sm font-bold text-slate-800'>Drag to Select Bug Area</span>
              <div className='w-px h-4 bg-slate-300 mx-1' />
              <kbd className='px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] text-slate-500 shadow-sm'>
                ESC to Cancel
              </kbd>
            </div>

            {selectionRect && (
              <div
                className='absolute border-2 border-[#13ec80] bg-[#13ec80]/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.5)]'
                style={{
                  left: selectionRect.left,
                  top: selectionRect.top,
                  width: selectionRect.width,
                  height: selectionRect.height,
                }}
              />
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCancelSelection();
              }}
              className='fixed top-6 right-6 p-2 bg-white rounded-full shadow-lg text-slate-600 hover:text-red-500 transition-colors pointer-events-auto'
            >
              <X className='w-6 h-6' />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

                        <motion.div
                            initial={{ opacity: 0, y: 15, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 15, scale: 0.98 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
<<<<<<< HEAD
                            className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl relative z-50 my-auto border border-slate-100 dark:border-white/[0.08] flex flex-col max-h-[85vh] overflow-hidden"
=======
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl relative z-50 my-auto border border-slate-100 dark:border-gray-700 flex flex-col max-h-[90vh]"
>>>>>>> upstream/gssoc
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/[0.05] shrink-0">
                                <div className="flex items-center gap-3.5 text-emerald-600 dark:text-[#13ec80]">
                                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                        <Bug className="w-5 h-5" />
                                    </div>
<<<<<<< HEAD
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight font-syne">Report a System Bug</h2>
=======
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Report a Bug</h2>
>>>>>>> upstream/gssoc
                                </div>
                                <button
                                    onClick={handleClose}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 rounded-full transition-colors border-none bg-transparent cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Scrollable Form Body */}
                            <div className="p-6 sm:p-8 overflow-y-auto customize-scrollbar flex-1 text-left space-y-6">
                                
                                {/* Compliance Info Banner */}
                                <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex gap-3.5 text-sm text-slate-600 dark:text-slate-300">
                                    <Info className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="font-extrabold text-slate-900 dark:text-white tracking-tight">Auto-Captured Diagnostic Protocol</p>
                                        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm leading-relaxed font-medium">
                                            Telemetry arrays, environment parameters, and log states compile dynamically. Detail your core user workflow disruption boundaries cleanly below.
                                        </p>
                                    </div>
                                </div>

                                <form id="bugReportForm" onSubmit={handleSubmit} className="space-y-5">
                                    {advanced && (
                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider ml-1" htmlFor="bug_title">
                                                Bug Title <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                id="bug_title"
                                                name="bug_title"
                                                required={advanced}
                                                value={formData.bug_title}
                                                onChange={handleChange}
                                                placeholder="e.g., File forensic validation pipeline stalls on base64 blocks"
                                                className="w-full px-4 h-12 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm shadow-inner"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider ml-1" htmlFor="description">
                                            What happened? <span className="text-rose-500">*</span>
                                        </label>
                                        <textarea
                                            id="description"
                                            name="description"
                                            required
                                            value={formData.description}
                                            onChange={handleChange}
                                            rows="3"
                                            placeholder="Describe the operational exception pattern in detail..."
                                            className="w-full p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm shadow-inner resize-none leading-relaxed font-medium"
                                        />
                                    </div>

                                    {advanced && (
                                        <>
                                            <div className="space-y-2">
                                                <label className="block text-xs font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider ml-1" htmlFor="steps_to_reproduce">
                                                    How can we reproduce this? <span className="text-slate-400 dark:text-slate-500 font-normal lowercase italic text-xs ml-1">(Optional)</span>
                                                </label>
                                                <textarea
                                                    id="steps_to_reproduce"
                                                    name="steps_to_reproduce"
                                                    value={formData.steps_to_reproduce}
                                                    onChange={handleChange}
                                                    rows="3"
                                                    placeholder="1. Navigate to...&#10;2. Initiate transaction block...&#10;3. Observe runtime exception mapping..."
                                                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm shadow-inner resize-none leading-relaxed font-mono"
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider ml-1" htmlFor="expected_result">
                                                        Expected Outcome
                                                    </label>
                                                    <textarea
                                                        id="expected_result"
                                                        name="expected_result"
                                                        value={formData.expected_result}
                                                        onChange={handleChange}
                                                        rows="2"
                                                        placeholder="Expected standard operation lifecycle..."
                                                        className="w-full p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm shadow-inner resize-none leading-relaxed font-medium"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider ml-1" htmlFor="actual_result">
                                                        Actual Exception Output
                                                    </label>
                                                    <textarea
                                                        id="actual_result"
                                                        name="actual_result"
                                                        value={formData.actual_result}
                                                        onChange={handleChange}
                                                        rows="2"
                                                        placeholder="Actual processing payload collapse matrix..."
                                                        className="w-full p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm shadow-inner resize-none leading-relaxed font-medium"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                                <CustomSelect
                                                    label="Severity Level"
                                                    name="severity"
                                                    value={formData.severity}
                                                    onChange={handleChange}
                                                    options={[
                                                        { value: 'Low', label: 'Low - Cosmetic/Minor' },
                                                        { value: 'Medium', label: 'Medium - Functional Defect' },
                                                        { value: 'High', label: 'High - System Blocker' },
                                                        { value: 'Critical', label: 'Critical - Pipeline Freeze' }
                                                    ]}
                                                />
                                                <CustomSelect
                                                    label="System Domain Classification"
                                                    name="category"
                                                    value={formData.category}
                                                    onChange={handleChange}
                                                    options={[
                                                        { value: 'UI Issue', label: 'UI/Layout Presentation' },
                                                        { value: 'Functionality Broken', label: 'Core Component Disruption' },
                                                        { value: 'Performance', label: 'Latency Degradation' },
                                                        { value: 'Security Issue', label: 'Vulnerability Isolation' },
                                                        { value: 'Other', label: 'Other' }
                                                    ]}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {advanced && (
                                        <>
                                            <label className="flex items-center gap-3.5 p-4 rounded-xl border border-slate-200 dark:border-white/[0.05] hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors mt-2 text-left">
                                                <input
                                                    type="checkbox"
                                                    name="contact_permission"
                                                    checked={formData.contact_permission}
                                                    onChange={handleChange}
                                                    className="w-4 h-4 text-emerald-600 dark:text-emerald-400 rounded border-slate-300 dark:border-white/10 bg-transparent focus:ring-emerald-500"
                                                />
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Grant permission for architectural team diagnostics contact parameters.</span>
                                            </label>

                                            {/* Diagnostics Matrix Display */}
                                            <div className="border border-slate-200 dark:border-white/[0.05] rounded-2xl overflow-hidden text-xs shadow-inner">
                                                <div className="bg-slate-50 dark:bg-white/[0.02] px-4 py-3 border-b border-slate-200 dark:border-white/[0.05] flex items-center gap-2">
                                                    <ShieldAlert className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                                    <span className="font-black text-slate-500 dark:text-slate-400 tracking-wider uppercase">Active Environmental Telemetry Node</span>
                                                </div>
                                                <div className="p-4 bg-transparent space-y-2.5 font-mono text-slate-500 dark:text-slate-400">
                                                    <div className="flex"><span className="w-24 shrink-0 text-slate-400 dark:text-slate-600 font-bold">Path:</span> <span className="truncate text-slate-800 dark:text-slate-300">{diagnostics.url.split(window.location.host)[1] || diagnostics.url}</span></div>
                                                    <div className="flex"><span className="w-24 shrink-0 text-slate-400 dark:text-slate-600 font-bold">Browser:</span> <span className="truncate text-slate-800 dark:text-slate-300" title={diagnostics.browser}>{diagnostics.browser.split(' ')[0]} {diagnostics.browser.split(' ')[diagnostics.browser.split(' ').length - 1]}</span></div>
                                                    <div className="flex"><span className="w-24 shrink-0 text-slate-400 dark:text-slate-600 font-bold">Screen:</span> <span className="text-slate-800 dark:text-slate-300">{diagnostics.screen}</span></div>
                                                    <div className="flex"><span className="w-24 shrink-0 text-slate-400 dark:text-slate-600 font-bold">Exceptions:</span> <span className={diagnostics.consoleErrors.length > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-800 dark:text-slate-300"}>{diagnostics.consoleErrors.length} detected</span></div>
                                                    <div className="flex"><span className="w-24 shrink-0 text-slate-400 dark:text-slate-600 font-bold">Collector:</span> <span className="text-emerald-600 dark:text-emerald-400 font-bold">Telemetry Active</span></div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Capture Action Controls */}
                                    {advanced && (
                                        <div className="border border-slate-200 dark:border-white/[0.05] rounded-2xl p-5 bg-slate-50 dark:bg-white/[0.01] space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="space-y-0.5">
                                                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                                                        <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Partial Interface Frame Injection
                                                    </h3>
                                                    <p className="text-xs text-slate-500">Capture an exact regional viewport coordinate bounding box block map.</p>
                                                </div>
                                                {!screenshotData && (
                                                    <button
                                                        type="button"
                                                        onClick={handleCaptureScreenshot}
                                                        disabled={isSubmitting}
                                                        className="px-4 h-10 text-xs font-bold text-white dark:text-slate-900 bg-emerald-600 dark:bg-emerald-400 hover:bg-emerald-500 dark:hover:bg-emerald-300 transition-colors rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer border-none uppercase tracking-wider shrink-0"
                                                    >
                                                        <Crop className="w-3.5 h-3.5" /> Select Area
                                                    </button>
                                                )}
                                            </div>

                                            <AnimatePresence>
                                                {screenshotData && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="relative mt-2 group rounded-xl overflow-hidden border border-slate-200 dark:border-white/10"
                                                    >
                                                        <img src={screenshotData} alt="Captured screen" className="w-full h-auto max-h-48 object-cover" />
                                                        <div className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <button
                                                                type="button"
                                                                onClick={handleClearScreenshot}
                                                                className="px-4 h-10 bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-rose-500 transition-colors shadow-lg border-none cursor-pointer uppercase tracking-wider"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" /> Remove Frame
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </form>
                            </div>

<<<<<<< HEAD
                            {/* Sticky Modal Action Footer */}
                            <div className="p-5 border-t border-slate-100 dark:border-white/[0.05] bg-slate-50 dark:bg-white/[0.02] rounded-b-2xl shrink-0 flex justify-end gap-3.5">
=======
                            {/* Footer */}
                            <div className="p-5 border-t border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-900 rounded-b-2xl shrink-0 flex justify-end gap-3">
>>>>>>> upstream/gssoc
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="px-5 h-11 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all border-none bg-transparent cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    form="bugReportForm"
                                    disabled={isSubmitting}
                                    className="px-6 h-11 text-sm font-bold text-white dark:text-slate-900 bg-emerald-600 dark:bg-emerald-400 hover:bg-emerald-500 dark:hover:bg-emerald-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded-xl shadow-xl flex items-center gap-2 border-none cursor-pointer uppercase tracking-wider"
                                >
                                    <span>{isSubmitting ? 'Transmitting...' : 'Submit Report'}</span>
                                    {!isSubmitting && <Send className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Region Selection Overlay */}
            <AnimatePresence>
                {isSelectingRegion && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        className="fixed inset-0 z-[9999] bg-slate-950/40 cursor-crosshair flex flex-col items-center justify-start pt-12 select-none"
                    >
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-3 pointer-events-none">
                            <MousePointer2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">Drag Pointer Over Target Coordinates</span>
                            <div className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-1" />
                            <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase shadow-sm">ESC to Cancel</kbd>
                        </div>

                        {selectionRect && (
                            <div
                                className="absolute border border-emerald-500 bg-emerald-500/10 shadow-[0_0_0_9999px_rgba(5,5,8,0.6)]"
                                style={{
                                    left: selectionRect.left,
                                    top: selectionRect.top,
                                    width: selectionRect.width,
                                    height: selectionRect.height
                                }}
                            />
                        )}

                        <button
                            onClick={(e) => { e.stopPropagation(); handleCancelSelection(); }}
                            className="fixed top-6 right-6 p-2.5 bg-white dark:bg-slate-900 rounded-full shadow-xl text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors pointer-events-auto border border-slate-200 dark:border-white/10 cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <style dangerouslySetInnerHTML={{
                __html: `
                .customize-scrollbar::-webkit-scrollbar { width: 6px; }
                .customize-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .customize-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
                .customize-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `,
        }}
      />
    </>
  );
};

export default BugReportWidget;
