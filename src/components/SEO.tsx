import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
    schemaData?: object;
}

const SEO: React.FC<SEOProps> = ({
    title,
    description,
    image = 'https://www.subastandolo.com/icons/icon-512.png',
    url = 'https://www.subastandolo.com',
    type = 'website',
    schemaData,
}) => {
    const siteTitle = 'Subastandolo.com | Subastas Online en Venezuela';
    const fullTitle = title ? `${title} | Subastandolo.com` : siteTitle;
    const defaultDescription = 'La plataforma de subastas más segura de Venezuela. Compra tecnología, hogar y más con solo el 5% de comisión. ¡El mejor postor gana!';
    const metaDescription = description || defaultDescription;

    return (
        <Helmet>
            {/* Basic Meta Tags */}
            <title>{fullTitle}</title>
            <meta name="description" content={metaDescription} />
            <link rel="canonical" href={url} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={url} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={metaDescription} />
            <meta property="og:image" content={image} />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={url} />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={metaDescription} />
            <meta name="twitter:image" content={image} />

            {/* JSON-LD Structured Data */}
            {schemaData && (
                <script type="application/ld+json">
                    {JSON.stringify(schemaData)}
                </script>
            )}
        </Helmet>
    );
};

export default SEO;
