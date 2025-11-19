/**
 * Company Information Configuration
 * Used in email templates and footer
 */

export const COMPANY_INFO = {
  name: "AmeriLend",
  logo: {
    url: "https://www.amerilendloan.com/images/logo-new.jpg",
    alt: "AmeriLend Logo",
  },
  contact: {
    email: "support@amerilendloan.com",
    phone: "+1 (945) 212-1609",
    phoneFormatted: "+1 945 212-1609",
    whatsapp: "+1 (945) 212-1609",
    telegram: "@amerilendloans",
  },
  admin: {
    email: "admin@amerilendloan.com",
  },
  address: {
    street: "123 Main Street",
    city: "New York",
    state: "NY",
    zip: "10001",
    country: "USA",
    formatted: "123 Main Street, New York, NY 10001, USA",
  },
  website: "https://www.amerilendloan.com",
  social: {
    facebook: "https://facebook.com/amerilend",
    twitter: "https://twitter.com/amerilend",
    instagram: "https://instagram.com/amerilend",
    linkedin: "https://linkedin.com/company/amerilend",
  },
  images: {
    whatsappIcon: "https://www.amerilendloan.com/images/whatsapp-logo.png",
    telegramIcon: "https://www.amerilendloan.com/images/telegram-logo.png",
    emailIcon: "https://cdn-icons-png.flaticon.com/512/561/561127.png",
    trustpilotLogo: "https://www.amerilendloan.com/images/trustpilot-logo.svg",
    lendingTreeLogo: "https://www.amerilendloan.com/images/lending-tree-logo.svg",
    bbbLogo: "https://www.amerilendloan.com/images/bbb.png",
  },
};

/**
 * Generate email footer HTML with company info
 */
export function getEmailFooter(): string {
  return `
    <div style="background-color: #f5f5f5; border-top: 3px solid #0033A0; padding: 30px 20px; margin-top: 30px; text-align: center; font-size: 12px; color: #666;">
      <div style="margin-bottom: 20px;">
        <img src="${COMPANY_INFO.logo.url}" alt="${COMPANY_INFO.logo.alt}" style="display: block; height: 45px; width: auto; margin: 0 auto 10px; border: 0; max-width: 100%; max-height: 60px;">
      
      <p style="margin: 8px 0; font-weight: bold; font-size: 16px; color: #0033A0;">${COMPANY_INFO.name}</p>
      
      <div style="margin: 20px 0; line-height: 1.9;">
        <p style="margin: 8px 0; color: #555;">
          <strong>📍 Address:</strong><br>${COMPANY_INFO.address.formatted}
        </p>
        <p style="margin: 12px 0;">
          <strong>📧 Email:</strong> <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0; text-decoration: none; font-weight: 500;">${COMPANY_INFO.contact.email}</a>
        </p>
        <p style="margin: 12px 0;">
          <strong>📞 Call Us:</strong> <a href="tel:${COMPANY_INFO.contact.phoneFormatted.replace(/\D/g, '')}" style="color: #0033A0; text-decoration: none; font-weight: 500;">${COMPANY_INFO.contact.phone}</a>
        </p>
      </div>
      
      <div style="margin: 25px 0; padding: 20px 0; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd;">
        <p style="margin: 10px 0 15px 0; font-weight: bold; font-size: 13px; color: #333;">📱 Connect With Us</p>
        <div style="margin-top: 12px; display: flex; justify-content: space-around; gap: 30px; flex-wrap: wrap; align-items: center; max-width: 400px; margin-left: auto; margin-right: auto;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <a href="https://wa.me/${COMPANY_INFO.contact.whatsapp.replace(/\D/g, '')}" style="display: inline-block; text-decoration: none;" title="WhatsApp">
              <img src="${COMPANY_INFO.images.whatsappIcon}" alt="WhatsApp" style="display: block; height: 30px; width: 30px; border: 0; border-radius: 5px; max-width: 100%;">
            </a>
            <span style="font-size: 11px; color: #666;">WhatsApp</span>
          </div>
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <a href="https://t.me/${COMPANY_INFO.contact.telegram.replace('@', '')}" style="display: inline-block; text-decoration: none;" title="Telegram">
              <img src="${COMPANY_INFO.images.telegramIcon}" alt="Telegram" style="display: block; height: 30px; width: 30px; border: 0; border-radius: 5px; max-width: 100%;">
            </a>
            <span style="font-size: 11px; color: #666;">Telegram</span>
          </div>
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <a href="mailto:${COMPANY_INFO.contact.email}" style="display: inline-block; text-decoration: none;" title="Email Support">
              <img src="${COMPANY_INFO.images.emailIcon}" alt="Support" style="display: block; height: 30px; width: 30px; border: 0; border-radius: 5px; max-width: 100%;">
            </a>
            <span style="font-size: 11px; color: #666;">Email</span>
          </div>
        </div>
      </div>

      <div style="margin: 25px 0; padding: 20px 0; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd;">
        <p style="margin: 10px 0 15px 0; font-weight: bold; font-size: 13px; color: #333;">✅ Trusted By Thousands</p>
        <div style="margin-top: 12px; display: flex; justify-content: center; gap: 40px; flex-wrap: wrap; align-items: center; max-width: 600px; margin-left: auto; margin-right: auto;">
          <div style="display: flex; justify-content: center; align-items: center;">
            <img src="${COMPANY_INFO.images.trustpilotLogo}" alt="Trustpilot" style="display: block; height: 50px; max-width: 150px; width: auto; border: 0; object-fit: contain;">
          </div>
          <div style="display: flex; justify-content: center; align-items: center;">
            <img src="${COMPANY_INFO.images.lendingTreeLogo}" alt="LendingTree" style="display: block; height: 50px; max-width: 150px; width: auto; border: 0; object-fit: contain;">
          </div>
          <div style="display: flex; justify-content: center; align-items: center;">
            <img src="${COMPANY_INFO.images.bbbLogo}" alt="Better Business Bureau" style="display: block; height: 50px; max-width: 150px; width: auto; border: 0; object-fit: contain;">
          </div>
        </div>
      </div>
      
      <div style="margin-top: 20px; padding-top: 15px;">
        <p style="margin: 6px 0; color: #999; font-size: 11px;">
          © ${new Date().getFullYear()} ${COMPANY_INFO.name}. All rights reserved.
        </p>
        <p style="margin: 8px 0; color: #999; font-size: 11px;">
          <a href="${COMPANY_INFO.website}/legal/privacy-policy" style="color: #0033A0; text-decoration: none;">Privacy Policy</a>
          <span style="margin: 0 8px; color: #ccc;">•</span>
          <a href="${COMPANY_INFO.website}/legal/terms-of-service" style="color: #0033A0; text-decoration: none;">Terms of Service</a>
        </p>
      </div>
    </div>
  `;
}

/**
 * Generate email header HTML with logo
 */
export function getEmailHeader(): string {
  return `
    <div style="background-color: #ffffff; padding: 35px 20px; text-align: center; border-bottom: 4px solid #FFA500;">
      <div style="margin-bottom: 15px;">
        <img src="${COMPANY_INFO.logo.url}" alt="${COMPANY_INFO.logo.alt}" style="height: 110px; max-width: 90%; object-fit: contain;">
      </div>
      <h1 style="color: #0033A0; margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 0.5px;">AmeriLend</h1>
      <p style="color: #666; margin: 10px 0 0 0; font-size: 14px; font-weight: 500;">💼 Trusted Lending Solutions</p>
      <p style="color: #999; margin: 5px 0 0 0; font-size: 12px;">Making Dreams Possible</p>
    </div>
  `;
}
