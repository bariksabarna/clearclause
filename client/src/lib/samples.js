/**
 * Sample legal records for the upload screen.
 *
 * Clicking a sample chip runs the same analyze pipeline as a pasted document —
 * the server receives the text over JSON { text } without a file.
 */

const JOB_OFFER_TEXT = `Job Offer Letter

Dear Candidate,

This letter confirms our offer of employment to you as Senior Product Designer.

1. Salary and Bonus. Your annual base salary will be $140,000. You are eligible for a discretionary performance bonus of up to 10% of base salary.

2. At-Will Employment. Your employment and this offer are at-will. Either party may terminate the relationship at any time, with or without cause and without prior notice.

3. Non-Compete. You agree that for a period of 18 months after termination of employment, you will not work for any competitor of the Company in any capacity.

4. Intellectual Property. Any inventions, designs, or works you create during your employment shall be the sole property of the Company.

5. Probation. Your first three (3) months are a probationary period. During probation we may terminate your employment without the notice otherwise required by company policy.

6. Relocation. If you voluntarily resign within 12 months of starting, you must repay the relocation stipend of $8,000 in full.`;

const LEASE_TEXT = `Residential Apartment Lease Agreement

1. Term. This lease begins on October 1, 2024 and ends on September 30, 2025.

2. Rent. Tenant shall pay $2,450.00 per month. Rent is due on the first day of each month.

3. Rent Escalation. The Lessor reserves an express right to unilaterally increase base monthly rent by up to 8.5% upon 90 days written notice, without requiring renewal.

4. Security Deposit. Tenant pays a security deposit of $2,450.00. The deposit shall be returned within 30 days after the lease ends.

5. Automatic Renewal. Unless Tenant gives written notice at least 90 days before the lease ends, this agreement shall automatically renew for another consecutive twelve (12) month term. Early termination is not permitted during any renewal term.

6. Entry. The Lessor may enter the premises at any time without prior notice for repairs, inspections, or showings.

7. Indemnity. Tenant agrees to indemnify and hold harmless the Lessor from any and all liabilities, losses, or attorney fees occurring on the premises, regardless of the Lessor's own negligence.`;

const SAAS_TOS_TEXT = `Software as a Service Terms of Service

1. Acceptance. By creating an account you agree to these Terms of Service.

2. Service. We provide a cloud-based subscription service. We may change, suspend, or discontinue any feature of the Service at any time without notice.

3. Payment. Subscription fees are billed in advance and are non-refundable except where required by law. Unused portions of a subscription are not credited. The current rate is $49 per user per month and may change in the next billing cycle without notice.

4. Termination. We may terminate or suspend your access immediately, without notice or liability, for any reason whatsoever, including without limitation a breach of these Terms.

5. Automatic Renewal. Unless you cancel at least thirty (30) days before the end of your subscription period, your subscription will auto-renew at the then-current rate.

6. Limitation of Liability. In no event shall we be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, even if advised of the possibility of such damages. Our total liability shall not exceed the amount you paid us in the six (6) months preceding the claim, but in no event more than $500.

7. Data Deletion. Upon termination, we may delete your account data permanently and are not obligated to export or return it.`;

export const SAMPLES = [
  {
    key: 'job-offer',
    category: 'Employment',
    title: 'A job offer letter',
    fileName: 'Senior Product Designer Offer.pdf',
    text: JOB_OFFER_TEXT,
  },
  {
    key: 'rental-lease',
    category: 'Real Estate',
    title: 'A rental lease',
    fileName: '12-Month Apartment Lease.pdf',
    text: LEASE_TEXT,
  },
  {
    key: 'saas-tos',
    category: 'Commercial',
    title: 'A terms of service page',
    fileName: 'SaaS Terms of Service.pdf',
    text: SAAS_TOS_TEXT,
  },
];

export const SAMPLE_BY_KEY = Object.fromEntries(SAMPLES.map((sample) => [sample.key, sample]));

export function sampleByKey(key) {
  return SAMPLE_BY_KEY[key] ?? null;
}
