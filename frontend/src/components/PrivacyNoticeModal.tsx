interface PrivacyNoticeModalProps {
  onClose: () => void;
}

export default function PrivacyNoticeModal({
  onClose,
}: PrivacyNoticeModalProps) {
  const contactInfo = {
    organization: "Persoonlijk beheer",
    email: "sam.vandenabeele.09@gmail.com",
    phone: "+32 465 09 45 56",
    address: "Stationsstraat 113, 9850 Landegem",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-white/10 bg-slate-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">
            Privacy Policy & GDPR Notice
          </h1>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 text-slate-300">
          {/* Organization */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              1. Data Controller
            </h2>
            <p className="mb-2">
              <strong>{contactInfo.organization}</strong>
            </p>
            <div className="space-y-1 text-sm">
              <p>
                <strong>Address:</strong> {contactInfo.address}
              </p>
              <p>
                <strong>Email:</strong>{" "}
                <a
                  href={`mailto:${contactInfo.email}`}
                  className="text-cyan-400 hover:text-cyan-300"
                >
                  {contactInfo.email}
                </a>
              </p>
              <p>
                <strong>Phone:</strong>{" "}
                <a
                  href={`tel:${contactInfo.phone}`}
                  className="text-cyan-400 hover:text-cyan-300"
                >
                  {contactInfo.phone}
                </a>
              </p>
            </div>
          </section>

          {/* Personal Data Collected */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              2. Personal Data We Collect
            </h2>
            <p className="mb-3">
              We collect and process the following personal data:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Login credentials (username/email and password)</li>
              <li>User profile information (name, contact details)</li>
              <li>Camp and participant information</li>
              <li>Diary entries and activity logs</li>
              <li>IP address and session information</li>
              <li>Access logs and usage patterns</li>
            </ul>
          </section>

          {/* Legal Basis */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              3. Legal Basis for Processing
            </h2>
            <p className="mb-3">We process your personal data based on:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>
                <strong>Contract:</strong> Processing necessary to fulfill our
                services
              </li>
              <li>
                <strong>Legal obligation:</strong> Compliance with applicable
                laws
              </li>
              <li>
                <strong>Legitimate interests:</strong> System security and fraud
                prevention
              </li>
              <li>
                <strong>Consent:</strong> Where explicitly granted by you
              </li>
            </ul>
          </section>

          {/* Purpose of Processing */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              4. Purpose of Processing
            </h2>
            <p className="mb-3">
              Your personal data is processed for the following purposes:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Account authentication and authorization</li>
              <li>Service delivery and functionality</li>
              <li>Security and fraud prevention</li>
              <li>System administration and maintenance</li>
              <li>Legal and regulatory compliance</li>
            </ul>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              5. Data Retention
            </h2>
            <p>
              We retain your personal data for as long as necessary to provide
              our services or comply with legal obligations. You can request
              deletion of your data at any time, subject to legal retention
              requirements.
            </p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              6. Your GDPR Rights
            </h2>
            <p className="mb-3">Under GDPR, you have the right to:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>
                <strong>Access:</strong> Request a copy of your personal data
              </li>
              <li>
                <strong>Rectification:</strong> Correct inaccurate data
              </li>
              <li>
                <strong>Erasure:</strong> Request deletion of your data (right
                to be forgotten)
              </li>
              <li>
                <strong>Restrict processing:</strong> Limit how your data is
                used
              </li>
              <li>
                <strong>Data portability:</strong> Receive your data in a
                portable format
              </li>
              <li>
                <strong>Object:</strong> Oppose certain types of processing
              </li>
              <li>
                <strong>Withdraw consent:</strong> Revoke consent at any time
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, please contact us at{" "}
              <a
                href={`mailto:${contactInfo.email}`}
                className="text-cyan-400 hover:text-cyan-300"
              >
                {contactInfo.email}
              </a>
              .
            </p>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              7. Data Security
            </h2>
            <p>
              We implement appropriate technical and organizational measures to
              protect your personal data against unauthorized access,
              alteration, disclosure, or destruction. However, no method of
              transmission over the Internet or electronic storage is completely
              secure.
            </p>
          </section>

          {/* Third Parties */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              8. Sharing with Third Parties
            </h2>
            <p>
              We do not share your personal data with third parties except where
              required by law or where necessary to provide our services. Any
              sharing is done in compliance with GDPR.
            </p>
          </section>

          {/* Changes */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              9. Changes to This Policy
            </h2>
            <p>
              We may update this privacy policy periodically. Changes will be
              effective immediately upon posting to the application. Your
              continued use constitutes acceptance of updates.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              10. Contact Us
            </h2>
            <p className="mb-3">
              For questions about this privacy policy or your personal data,
              please contact:
            </p>
            <div className="space-y-1 text-sm bg-white/5 p-3 rounded border border-white/10">
              <p>
                <strong>{contactInfo.organization}</strong>
              </p>
              <p>{contactInfo.address}</p>
              <p>
                <a
                  href={`mailto:${contactInfo.email}`}
                  className="text-cyan-400 hover:text-cyan-300"
                >
                  {contactInfo.email}
                </a>
              </p>
              <p>
                <a
                  href={`tel:${contactInfo.phone}`}
                  className="text-cyan-400 hover:text-cyan-300"
                >
                  {contactInfo.phone}
                </a>
              </p>
            </div>
          </section>

          {/* Last Updated */}
          <section className="border-t border-white/10 pt-4">
            <p className="text-xs text-slate-500">
              Last updated:{" "}
              {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
