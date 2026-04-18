import React from 'react';
import { Box, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const SUPPORT_EMAIL = 'support@aycindustries.com';
const WEBSITE = 'https://www.aycindustries.com';

function Li({ children }) {
  return (
    <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mb: 0.5 }}>
      {children}
    </Typography>
  );
}

export function TermsOfUseContent({ showHeading = true } = {}) {
  return (
    <>
      {showHeading ? (
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 1.5 }}>
          Terms of Use – AYC Industries
        </Typography>
      ) : null}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
        These Terms of Use (the &quot;Terms&quot;) constitute a legally binding agreement between you (&quot;User&quot;,
        &quot;you&quot;) and AYC Industries (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
        By accessing or using our website{' '}
        <Link href={WEBSITE} target="_blank" rel="noopener noreferrer" underline="hover">
          www.aycindustries.com
        </Link>{' '}
        (the &quot;Website&quot;) and its services (the &quot;Services&quot;), you agree to be bound by these Terms. If
        you do not agree with these Terms, you must not use the Website or Services.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
        These Terms should be read along with our{' '}
        <Link component={RouterLink} to="/privacy-policy" underline="hover">
          Privacy Policy
        </Link>
        .
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        1. Access and Subscription
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        We provide access to our Services in the following ways:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
        <Li>Free access to browse information available on the Website</Li>
        <Li>Free access to certain features upon registration/login</Li>
        <Li>Paid subscription plans for access to premium features and services</Li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65, fontWeight: 700 }}>
        For registered and paid users:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
        <Li>You must complete the registration process by providing accurate details</Li>
        <Li>An account will be created, and login credentials will be shared via email or other communication methods</Li>
        <Li>Features and pricing of paid plans will be displayed on the Website</Li>
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        2. User Obligations
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        By using our Services, you agree to:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5 }}>
        <Li>Maintain confidentiality of your account credentials</Li>
        <Li>Restrict unauthorized access to your account</Li>
        <Li>Provide accurate, current, and complete information</Li>
        <Li>Use the Services only for lawful purposes</Li>
        <Li>Comply with all applicable laws and regulations</Li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        You agree not to:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
        <Li>Copy, reproduce, modify, or distribute Website content</Li>
        <Li>Reverse engineer, decompile, or disassemble any part of the Services</Li>
        <Li>Create derivative works or exploit any content commercially without permission</Li>
        <Li>Use the platform for illegal, fraudulent, or harmful activities</Li>
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        3. Intellectual Property Rights
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.65 }}>
        All content on this Website—including but not limited to text, graphics, logos, software, and processes—is the
        property of AYC Industries or its licensors.
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
        <Li>No rights or licenses are granted except for personal, non-commercial use</Li>
        <Li>Unauthorized use, reproduction, or distribution is strictly prohibited</Li>
        <Li>Prior written permission is required for any commercial usage</Li>
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        4. Account Termination
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
        <Li>You may terminate your account at any time by discontinuing use</Li>
        <Li>We reserve the right to suspend or terminate accounts for violations of these Terms</Li>
        <Li>No refunds will be provided for any paid subscriptions upon termination</Li>
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        5. Service Availability and Interruptions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        AYC Industries shall not be held liable for any interruptions or delays caused by:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5 }}>
        <Li>Technical failures or system breakdowns</Li>
        <Li>Network or telecommunication issues</Li>
        <Li>Natural disasters, strikes, or unforeseen events</Li>
        <Li>Acts beyond our reasonable control</Li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
        During such events, access to Services may be temporarily unavailable.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        6. Limitation of Liability
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        To the maximum extent permitted by law, AYC Industries (including its directors, employees, and affiliates)
        shall not be liable for:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5 }}>
        <Li>Indirect, incidental, or consequential damages</Li>
        <Li>Loss of profits, business, or data</Li>
        <Li>Business interruption or system failures</Li>
        <Li>Loss of privacy or confidential information</Li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
        This applies even if we have been advised of potential damages.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        7. Disclaimer of Warranties
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.65 }}>
        The Website and Services are provided &quot;as is&quot; and &quot;as available.&quot; We expressly disclaim all
        warranties, including merchantability, fitness for a particular purpose, non-infringement, and accuracy or
        reliability of content.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        You acknowledge that:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
        <Li>Technology and business environments evolve</Li>
        <Li>You are responsible for evaluating the usefulness of Services</Li>
        <Li>Support or updates are provided only if included in a paid plan</Li>
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        8. Governing Law and Jurisdiction
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
        These Terms shall be governed by the laws of India. Any disputes arising out of or related to the use of this
        Website shall be subject to the exclusive jurisdiction of the courts in Bengaluru, India.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        9. Changes to Terms
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
        <Li>We reserve the right to update or modify these Terms at any time</Li>
        <Li>Changes will be posted on this page</Li>
        <Li>Continued use of the Website constitutes acceptance of updated Terms</Li>
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        10. Contact Information
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
        For any queries regarding these Terms, you may contact us through the details provided on{' '}
        <Link href={WEBSITE} target="_blank" rel="noopener noreferrer" underline="hover">
          www.aycindustries.com
        </Link>
        , or email{' '}
        <Link href={`mailto:${SUPPORT_EMAIL}`} underline="hover">
          {SUPPORT_EMAIL}
        </Link>
        .
      </Typography>
    </>
  );
}

function TermsOfUsePage() {
  return (
    <Box sx={{ maxWidth: 880 }}>
      <TermsOfUseContent />
    </Box>
  );
}

export default TermsOfUsePage;
