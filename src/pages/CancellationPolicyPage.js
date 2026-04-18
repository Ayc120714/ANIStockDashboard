import React from 'react';
import { Box, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const WEBSITE = 'https://www.aycindustries.com';

function Li({ children }) {
  return (
    <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mb: 0.5 }}>
      {children}
    </Typography>
  );
}

export function CancellationPolicyContent({ showHeading = true } = {}) {
  return (
    <>
      {showHeading ? (
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 1.5 }}>
          Cancellation policy – AYC Industries
        </Typography>
      ) : null}

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 0.5, mb: 1 }}>
        1. Cancellation of Subscription
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        If you are on a paid subscription:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
        <Li>You may cancel your subscription at any time</Li>
        <Li>
          Upon cancellation, you will continue to enjoy all premium benefits until the end of your current billing cycle
        </Li>
        <Li>
          To avoid being charged for the next billing cycle, you must cancel your subscription at least 48 hours before
          the renewal date
        </Li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
        Failure to cancel within this time frame may result in automatic renewal and billing.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        2. Refund Policy
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
        <Li>No refunds will be provided for any subscription once payment has been made</Li>
        <Li>Upon cancellation, your subscription will remain active until the next renewal date</Li>
        <Li>
          You will not be billed again after successful cancellation (subject to the 48-hour condition mentioned above)
        </Li>
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        3. Account Suspension / Termination
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        In the event of:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5 }}>
        <Li>Account suspension</Li>
        <Li>Account deactivation</Li>
        <Li>Restriction due to policy violations</Li>
        <Li>Termination of account</Li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.65 }}>
        AYC Industries shall not be liable to provide any refund for:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5 }}>
        <Li>Active subscriptions</Li>
        <Li>Unused subscription periods</Li>
        <Li>Any previously paid fees</Li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.65 }}>
        Users are advised to review our{' '}
        <Link component={RouterLink} to="/terms-of-use" underline="hover">
          Terms of Use
        </Link>{' '}
        for detailed conditions regarding account actions.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        4. Important Notes
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
        <Li>Subscription fees are non-transferable</Li>
        <Li>Benefits associated with subscriptions are non-exchangeable</Li>
        <Li>It is your responsibility to manage your subscription and renewal timelines</Li>
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 2.5, mb: 1 }}>
        5. Contact
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
        For any queries related to subscriptions or cancellations, please contact us via the details available on{' '}
        <Link href={WEBSITE} target="_blank" rel="noopener noreferrer" underline="hover">
          www.aycindustries.com
        </Link>
        .
      </Typography>
    </>
  );
}

function CancellationPolicyPage() {
  return (
    <Box sx={{ maxWidth: 880 }}>
      <CancellationPolicyContent />
    </Box>
  );
}

export default CancellationPolicyPage;
