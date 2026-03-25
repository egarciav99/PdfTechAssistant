import React from 'react';
import { useTranslation } from 'react-i18next';

interface UploadStep {
    id: string;
    label: string;
    description: string;
    status: 'pending' | 'active' | 'complete' | 'error';
}

interface UploadProgressProps {
    currentStep: number;
}

const UploadProgress: React.FC<UploadProgressProps> = ({ currentStep }) => {
    const { t } = useTranslation();
    const steps: UploadStep[] = [
        {
            id: '1',
            label: t('uploadProgress.step1Label'),
            description: t('uploadProgress.step1Description'),
            status: currentStep > 0 ? 'complete' : 'active',
        },
        {
            id: '2',
            label: t('uploadProgress.step2Label'),
            description: t('uploadProgress.step2Description'),
            status: currentStep > 1 ? 'complete' : currentStep === 1 ? 'active' : 'pending',
        },
        {
            id: '3',
            label: t('uploadProgress.step3Label'),
            description: t('uploadProgress.step3Description'),
            status: currentStep > 2 ? 'complete' : currentStep === 2 ? 'active' : 'pending',
        },
        {
            id: '4',
            label: t('uploadProgress.step4Label'),
            description: t('uploadProgress.step4Description'),
            status: currentStep > 3 ? 'complete' : currentStep === 3 ? 'active' : 'pending',
        },
    ];

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">
                    {t('uploadProgress.title')}
                </h2>
                <p className="text-gray-500 text-center mb-8">
                    {t('uploadProgress.subtitle')}
                </p>

                <div className="space-y-6">
                    {steps.map((step, index) => (
                        <div key={step.id} className="flex items-start gap-4">
                            {/* Step Circle */}
                            <div
                                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all flex-shrink-0 ${step.status === 'complete'
                                    ? 'bg-green-500 text-white'
                                    : step.status === 'active'
                                        ? 'bg-blue-500 text-white animate-pulse'
                                        : step.status === 'error'
                                            ? 'bg-red-500 text-white'
                                            : 'bg-gray-200 text-gray-400'
                                    }`}
                            >
                                {step.status === 'complete' ? '✓' : index + 1}
                            </div>

                            {/* Step Content */}
                            <div className="flex-1 pt-2">
                                <p
                                    className={`font-semibold mb-1 ${step.status === 'active'
                                        ? 'text-blue-600'
                                        : step.status === 'complete'
                                            ? 'text-green-600'
                                            : 'text-gray-400'
                                        }`}
                                >
                                    {step.label}
                                </p>
                                <p className="text-sm text-gray-500">{step.description}</p>

                                {/* Progress Bar for Active Step */}
                                {step.status === 'active' && (
                                    <div className="mt-3 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full animate-pulse"
                                            style={{
                                                width: '60%',
                                                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                                            }}
                                        ></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800 text-center">
                        {t('uploadProgress.tip')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default UploadProgress;
