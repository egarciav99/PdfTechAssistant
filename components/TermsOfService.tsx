import React from 'react';
import { useTranslation } from 'react-i18next';

const TermsOfService: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 sm:p-10">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-6">
                    {t('legal.terms.title')}
                </h1>

                <p className="text-sm text-gray-500 mb-8">
                    {t('legal.terms.lastUpdated')}: {new Date().toLocaleDateString()}
                </p>

                <div className="space-y-8 text-gray-700">
                    {/* Acceptance */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.terms.acceptance.title')}
                        </h2>
                        <p className="leading-relaxed">
                            {t('legal.terms.acceptance.content')}
                        </p>
                    </section>

                    {/* Service Description */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.terms.service.title')}
                        </h2>
                        <p className="leading-relaxed">
                            {t('legal.terms.service.content')}
                        </p>
                    </section>

                    {/* User Obligations */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.terms.obligations.title')}
                        </h2>
                        <p className="mb-4">{t('legal.terms.obligations.intro')}</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>{t('legal.terms.obligations.item1')}</li>
                            <li>{t('legal.terms.obligations.item2')}</li>
                            <li>{t('legal.terms.obligations.item3')}</li>
                            <li>{t('legal.terms.obligations.item4')}</li>
                            <li>{t('legal.terms.obligations.item5')}</li>
                        </ul>
                    </section>

                    {/* Prohibited Uses */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.terms.prohibited.title')}
                        </h2>
                        <p className="mb-4">{t('legal.terms.prohibited.intro')}</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>{t('legal.terms.prohibited.item1')}</li>
                            <li>{t('legal.terms.prohibited.item2')}</li>
                            <li>{t('legal.terms.prohibited.item3')}</li>
                            <li>{t('legal.terms.prohibited.item4')}</li>
                        </ul>
                    </section>

                    {/* Intellectual Property */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.terms.intellectual.title')}
                        </h2>
                        <p className="leading-relaxed">
                            {t('legal.terms.intellectual.content')}
                        </p>
                    </section>

                    {/* Limitations */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.terms.limitations.title')}
                        </h2>
                        <p className="mb-4">{t('legal.terms.limitations.intro')}</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>{t('legal.terms.limitations.item1')}</li>
                            <li>{t('legal.terms.limitations.item2')}</li>
                            <li>{t('legal.terms.limitations.item3')}</li>
                        </ul>
                    </section>

                    {/* Disclaimer */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.terms.disclaimer.title')}
                        </h2>
                        <p className="leading-relaxed">
                            {t('legal.terms.disclaimer.content')}
                        </p>
                    </section>

                    {/* Termination */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.terms.termination.title')}
                        </h2>
                        <p className="leading-relaxed">
                            {t('legal.terms.termination.content')}
                        </p>
                    </section>

                    {/* Changes */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.terms.changes.title')}
                        </h2>
                        <p className="leading-relaxed">
                            {t('legal.terms.changes.content')}
                        </p>
                    </section>

                    {/* Contact */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.terms.contact.title')}
                        </h2>
                        <p className="leading-relaxed">
                            {t('legal.terms.contact.content')}
                        </p>
                    </section>
                </div>

                <div className="mt-10 pt-6 border-t border-gray-200">
                    <button
                        onClick={() => window.history.back()}
                        className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        {t('common.goBack')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TermsOfService;
