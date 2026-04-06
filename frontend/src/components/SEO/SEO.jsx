import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'Sipsip';
const SITE_URL  = 'https://siipsip.com';
const DEFAULT_DESCRIPTION =
  'Sipsip — your personal hydration tracker. Set daily water goals, log sips, and build healthy drinking habits with smart reminders.';

/**
 * Reusable SEO component for per-page <head> management.
 *
 * @param {string} title       – Page title (will be appended with " — Sipsip" unless it already contains it)
 * @param {string} description – Meta description for the page
 * @param {string} path        – URL path, e.g. "/dashboard"
 */
export default function SEO({
  title = SITE_NAME,
  description = DEFAULT_DESCRIPTION,
  path = '/',
}) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
  const url = `${SITE_URL}${path}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
}
