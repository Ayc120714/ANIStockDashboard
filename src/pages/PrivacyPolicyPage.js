import React from 'react';
import { Box, Link, Typography } from '@mui/material';

const SUPPORT_EMAIL = 'support@aycindustries.com';
const WEBSITE = 'https://www.aycindustries.com';

function Li({ children }) {
  return (
    <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mb: 0.5 }}>
      {children}
    </Typography>
  );
}

export function PrivacyPolicyContent({ showHeading = true } = {}) {
  return (
    <>
      {showHeading ? (
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 1.5 }}>
          Privacy Policy – AYC Industries
        </Typography>
      ) : null}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
        This Privacy Policy explains how AYC Industries (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;,
        &quot;our&quot;) collects, uses, discloses, and protects your personal data when you access or use{' '}
        <Link href={WEBSITE} target="_blank" rel="noopener noreferrer" underline="hover">
          www.aycindustries.com
        </Link>{' '}
        (the &quot;Website&quot;) and related services (the &quot;Services&quot;).
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
        By using our Website or submitting your Personal Data, you agree to the terms of this Privacy Policy.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        1. Overview
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.65 }}>
        You may browse our Website without registering or providing personal data. However, to access certain features
        or premium services, you may be required to create an account and submit personally identifiable information
        (&quot;Personal Data&quot;).
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        This Privacy Policy describes:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
        <Li>What data we collect</Li>
        <Li>How we use it</Li>
        <Li>When we share it</Li>
        <Li>Your rights regarding your data</Li>
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        2. Definitions
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
        <Li>
          <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
            &quot;User&quot;, &quot;You&quot;, &quot;Your&quot;:
          </Box>{' '}
          Any individual, entity, or organization using our Website or Services
        </Li>
        <Li>
          <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
            &quot;Website&quot;:
          </Box>{' '}
          www.aycindustries.com, any associated web pages, applications, or social media pages linking to this Privacy
          Policy
        </Li>
        <Li>
          <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
            &quot;Company&quot;, &quot;We&quot;, &quot;Us&quot;:
          </Box>{' '}
          AYC Industries and its affiliates
        </Li>
        <Li>
          <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
            &quot;Personal Data&quot;:
          </Box>{' '}
          Any identifiable information provided by you
        </Li>
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        3. Data Collection
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65, fontWeight: 700 }}>
        We collect Personal Data in two ways:
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, lineHeight: 1.65 }}>
        3.1 Information You Provide
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        When you register or interact with our Services, we may collect:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5 }}>
        <Li>Name (first and last)</Li>
        <Li>Username and password</Li>
        <Li>Email address</Li>
        <Li>Phone number</Li>
        <Li>Company details (if applicable)</Li>
        <Li>Payment or billing information</Li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, lineHeight: 1.65 }}>
        3.2 Automatically Collected Information
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        We use cookies and tracking technologies to collect:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
        <Li>IP address</Li>
        <Li>Device information and identifiers</Li>
        <Li>Browser type and settings</Li>
        <Li>Pages visited and usage behavior</Li>
        <Li>Session duration and access times</Li>
        <Li>Transaction data</Li>
        <Li>Log data (hardware/software details)</Li>
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        4. Use of Information
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        We use your Personal Data to:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
        <Li>Identify you within our system</Li>
        <Li>Provide and manage Services</Li>
        <Li>Improve Website functionality and user experience</Li>
        <Li>Process transactions and requests</Li>
        <Li>Send notifications, updates, and service-related communication</Li>
        <Li>Share newsletters, offers, and marketing content (with consent)</Li>
        <Li>Conduct analytics and market research</Li>
        <Li>Detect and prevent fraud or misuse</Li>
        <Li>Ensure platform security</Li>
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        5. Sharing of Information
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        We may share your data with:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5 }}>
        <Li>Affiliates and subsidiaries of AYC Industries</Li>
        <Li>Service providers (hosting, payment processing, communication tools)</Li>
        <Li>Business partners assisting in delivering services</Li>
        <Li>Payment gateways for transaction processing</Li>
        <Li>Regulatory authorities to comply with legal obligations</Li>
        <Li>Law enforcement agencies where required</Li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.65 }}>
        We may also share non-personally identifiable data for analytics or research.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
        We do not sell your Personal Data to third parties. Any sharing beyond the above will require your explicit
        consent.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        6. Cookies and Tracking Technologies
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        We use cookies and similar technologies to:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5 }}>
        <Li>Enable Website functionality</Li>
        <Li>Analyze usage patterns</Li>
        <Li>Improve user experience</Li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
        You may disable cookies through your browser settings, but some features may not function properly.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        7. Data Security
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        We implement appropriate technical and organizational measures to protect your data, including:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5 }}>
        <Li>Secure servers and encryption mechanisms</Li>
        <Li>Access controls and authentication systems</Li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        However, you acknowledge that:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
        <Li>Internet transmission is not completely secure</Li>
        <Li>We cannot guarantee absolute security of data transmitted online</Li>
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        8. Your Rights
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        You have the following rights regarding your Personal Data:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5 }}>
        <Li>Right to Access – Know what data we hold about you</Li>
        <Li>Right to Correction – Update or correct inaccurate data</Li>
        <Li>Right to Data Portability – Receive your data in a structured format</Li>
        <Li>Right to Erasure (&quot;Right to be Forgotten&quot;) – Request deletion of your data</Li>
        <Li>Right to Withdraw Consent – Opt out of data processing at any time</Li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
        To exercise these rights, you may contact us using the details below.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        9. Data Retention
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        We retain your Personal Data:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5 }}>
        <Li>As long as necessary to provide Services</Li>
        <Li>To comply with legal obligations</Li>
        <Li>For legitimate business purposes</Li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
        When no longer required, data will be deleted, anonymized, or securely archived.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        10. Consent
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.65 }}>
        By using our Website, you provide explicit consent to the collection, use, storage, and processing of your
        Personal Data as described in this Policy.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
        You may withdraw your consent at any time. Withdrawal will not affect prior lawful processing.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        11. Grievance Redressal
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        For any privacy-related concerns or complaints, you may contact:
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, lineHeight: 1.65 }}>
        Grievance Officer
        <br />
        AYC Industries
        <br />
        Email:{' '}
        <Link href={`mailto:${SUPPORT_EMAIL}`} underline="hover">
          {SUPPORT_EMAIL}
        </Link>
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
        You may also reach us through the contact details provided on{' '}
        <Link href={WEBSITE} target="_blank" rel="noopener noreferrer" underline="hover">
          www.aycindustries.com
        </Link>
        .
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        12. Updates to this Policy
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 0 }}>
        <Li>We may update this Privacy Policy from time to time</Li>
        <Li>Changes will be posted on this page</Li>
        <Li>Continued use of the Website implies acceptance of updates</Li>
      </Box>
    </>
  );
}

function PrivacyPolicyPage() {
  return (
    <Box sx={{ maxWidth: 880 }}>
      <PrivacyPolicyContent />
    </Box>
  );
}

export default PrivacyPolicyPage;
