import { useState } from "react";
import PrivacyNoticeModal from "./PrivacyNoticeModal";

const contactInfo = {
  organization: "Sam Vandenabeele",
  email: "sam.vandenabeele.09@gmail.com",
  phone: "+32 465 09 45 56",
  address: "Stationsstraat 113, 9850 Landegem",
};

export default function Footer() {
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);

  const currentYear = new Date().getFullYear();

  return (
    <>
      <footer className="mt-8 border-t border-white/10 bg-white/5 p-4 text-xs text-slate-400 backdrop-blur sm:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Organization Info */}
            <div>
              <h3 className="font-semibold text-slate-200">About</h3>
              <p className="mt-2 text-xs">{contactInfo.organization}</p>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="font-semibold text-slate-200">Contact</h3>
              <ul className="mt-2 space-y-1 text-xs">
                <li>
                  <a
                    href={`mailto:${contactInfo.email}`}
                    className="text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    {contactInfo.email}
                  </a>
                </li>
                <li>
                  <a
                    href={`tel:${contactInfo.phone}`}
                    className="text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    {contactInfo.phone}
                  </a>
                </li>
              </ul>
            </div>

            {/* Address */}
            <div>
              <h3 className="font-semibold text-slate-200">Address</h3>
              <p className="mt-2 text-xs leading-relaxed">
                {contactInfo.address}
              </p>
            </div>

            {/* Legal Links */}
            <div>
              <h3 className="font-semibold text-slate-200">Legal</h3>
              <ul className="mt-2 space-y-1">
                <li>
                  <button
                    onClick={() => setShowPrivacyNotice(true)}
                    className="text-cyan-400 hover:text-cyan-300 transition-colors text-xs"
                  >
                    Privacy Policy & GDPR
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-6 border-t border-white/10 pt-4 text-center text-xs text-slate-500">
            <p>
              &copy; {currentYear} {contactInfo.organization}. All rights
              reserved.
            </p>
            <p className="mt-1">
              Data processing in accordance with GDPR and applicable data
              protection laws.
            </p>
          </div>
        </div>
      </footer>

      {/* Privacy Notice Modal */}
      {showPrivacyNotice && (
        <PrivacyNoticeModal onClose={() => setShowPrivacyNotice(false)} />
      )}
    </>
  );
}
