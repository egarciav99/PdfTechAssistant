import React from 'react';
import { useTranslation } from 'react-i18next';

const PrivacyPolicy: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 sm:p-10">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-6">
                    {t('legal.privacy.title')}
                </h1>

                <p className="text-sm text-gray-500 mb-8">
                    {t('legal.privacy.lastUpdated')}: {new Date().toLocaleDateString()}
                </p>

                <div className="space-y-8 text-gray-700">
                    {/* Introduction */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.privacy.intro.title')}
                        </h2>
                        <p className="leading-relaxed">
                            {t('legal.privacy.intro.content')}
                        </p>
                    </section>

                    {/* Data Collection */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.privacy.dataCollection.title')}
                        </h2>
                        <p className="mb-4">{t('legal.privacy.dataCollection.intro')}</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>{t('legal.privacy.dataCollection.item1')}</li>
                            <li>{t('legal.privacy.dataCollection.item2')}</li>
                            <li>{t('legal.privacy.dataCollection.item3')}</li>
                            <li>{t('legal.privacy.dataCollection.item4')}</li>
                            <li>{t('legal.privacy.dataCollection.item5')}</li>
                        </ul>
                    </section>

                    {/* Data Usage */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.privacy.dataUsage.title')}
                        </h2>
                        <p className="mb-4">{t('legal.privacy.dataUsage.intro')}</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>{t('legal.privacy.dataUsage.item1')}</li>
                            <li>{t('legal.privacy.dataUsage.item2')}</li>
                            <li>{t('legal.privacy.dataUsage.item3')}</li>
                            <li>{t('legal.privacy.dataUsage.item4')}</li>
                        </ul>
                    </section>

                    {/* Data Sharing */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.privacy.dataSharing.title')}
                        </h2>
                        <p className="mb-4">{t('legal.privacy.dataSharing.intro')}</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li><strong>Google Gemini AI:</strong> {t('legal.privacy.dataSharing.gemini')}</li>
                            <li><strong>Firebase (Google):</strong> {t('legal.privacy.dataSharing.firebase')}</li>
                            <li><strong>Supabase:</strong> {t('legal.privacy.dataSharing.supabase')}</li>
                        </ul>
                    </section>

                    {/* Data Security */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.privacy.dataSecurity.title')}
                        </h2>
                        <p className="leading-relaxed">
                            {t('legal.privacy.dataSecurity.content')}
                        </p>
                    </section>

                    {/* User Rights */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.privacy.userRights.title')}
                        </h2>
                        <p className="mb-4">{t('legal.privacy.userRights.intro')}</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>{t('legal.privacy.userRights.access')}</li>
                            <li>{t('legal.privacy.userRights.rectification')}</li>
                            <li>{t('legal.privacy.userRights.deletion')}</li>
                            <li>{t('legal.privacy.userRights.export')}</li>
                            <li>{t('legal.privacy.userRights.objection')}</li>
                        </ul>
                    </section>

                    {/* Data Retention */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.privacy.dataRetention.title')}
                        </h2>
                        <p className="leading-relaxed">
                            {t('legal.privacy.dataRetention.content')}
                        </p>
                    </section>

                    {/* Contact */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            {t('legal.privacy.contact.title')}
                        </h2>
                        <p className="leading-relaxed">
                            {t('legal.privacy.contact.content')}
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

export default PrivacyPolicy;
