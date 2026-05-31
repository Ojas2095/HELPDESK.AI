import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Circle } from 'lucide-react';

const AIProcessingSteps = ({ steps = [], onComplete, delay = 1200, activeStep = null }) => {
    const [internalStep, setInternalStep] = useState(0);
    const currentStep = activeStep !== null ? activeStep : internalStep;

    useEffect(() => {
        if (activeStep !== null) return;

        if (internalStep < steps.length) {
            const timer = setTimeout(() => {
                setInternalStep(prev => prev + 1);
            }, delay);
            return () => clearTimeout(timer);
        } else if (internalStep === steps.length) {
            if (onComplete) {
                const timer = setTimeout(() => {
                    onComplete();
                }, 800);
                return () => clearTimeout(timer);
            }
        }
    }, [internalStep, steps.length, delay, onComplete, activeStep]);

    const progressPercentage = Math.min((currentStep / steps.length) * 100, 100);

    return (
        <div className="relative w-full h-full flex flex-col justify-between overflow-hidden">
            {/* Step Matrix Container */}
            <div className="w-full space-y-6 px-4 py-2">
                {steps.map((step, index) => {
                    const isCompleted = currentStep > index;
                    const isActive = currentStep === index;
                    const isPending = currentStep < index;

                    return (
                        <motion.div 
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ 
                                opacity: isPending ? 0.3 : 1, 
                                x: 0,
                                scale: isActive ? 1.02 : 1 
                            }}
                            transition={{ duration: 0.4 }}
                            className="flex items-center gap-4 text-left"
                        >
                            <div className="flex-shrink-0 relative flex items-center justify-center w-6 h-6">
                                <AnimatePresence mode="wait">
                                    {isCompleted ? (
                                        <motion.div
                                            key="completed"
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0.5, opacity: 0 }}
                                        >
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]" />
                                        </motion.div>
                                    ) : isActive ? (
                                        <motion.div
                                            key="active"
                                            initial={{ rotate: 0 }}
                                            animate={{ rotate: 360 }}
                                            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                        >
                                            <Loader2 className="w-5 h-5 text-emerald-400" />
                                        </motion.div>
                                    ) : (
                                        <motion.div key="pending">
                                            <Circle className="w-5 h-5 text-slate-700" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <span className={`text-sm font-bold uppercase tracking-widest transition-colors duration-300 ${
                                isCompleted ? 'text-slate-400' : 
                                isActive ? 'text-emerald-400 font-black' : 
                                'text-slate-600'
                            }`}>
                                {step}
                            </span>
                        </motion.div>
                    );
                })}
            </div>

            {/* High-Precision Progress Pipeline */}
            <div className="w-full h-1 bg-white/5 absolute bottom-0 left-0 overflow-hidden">
                <motion.div
                    className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 0.6, ease: "circOut" }}
                />
            </div>
        </div>
    );
};

export default AIProcessingSteps;