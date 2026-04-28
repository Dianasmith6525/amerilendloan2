import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Languages, Check } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

const languages = [
  { code: 'en', name: 'English', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'es', name: 'Espa\u00F1ol', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'fr', name: 'Fran\u00E7ais', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'de', name: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'zh-CN', name: '\u4E2D\u6587', flag: '\u{1F1E8}\u{1F1F3}' },
  { code: 'ja', name: '\u65E5\u672C\u8A9E', flag: '\u{1F1EF}\u{1F1F5}' },
  { code: 'pt', name: 'Portugu\u00EAs', flag: '\u{1F1E7}\u{1F1F7}' },
  { code: 'ru', name: '\u0420\u0443\u0441\u0441\u043A\u0438\u0439', flag: '\u{1F1F7}\u{1F1FA}' },
  { code: 'ar', name: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629', flag: '\u{1F1F8}\u{1F1E6}' },
  { code: 'hi', name: '\u0939\u093F\u0928\u094D\u0926\u0940', flag: '\u{1F1EE}\u{1F1F3}' },
];

function getGoogleTranslateLang(): string {
  const match = document.cookie.match(/googtrans=\/en\/([a-zA-Z-]+)/);
  return match?.[1] || 'en';
}

function setGoogleTranslateLang(lang: string) {
  const domain = window.location.hostname;
  document.cookie = `googtrans=/en/${lang}; path=/; domain=${domain}`;
  document.cookie = `googtrans=/en/${lang}; path=/`;
  const parts = domain.split('.');
  if (parts.length > 2) {
    const root = parts.slice(-2).join('.');
    document.cookie = `googtrans=/en/${lang}; path=/; domain=.${root}`;
  }
}

export function LanguageSwitcher() {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const { isAuthenticated } = useAuth();
  const updateProfile = trpc.auth.updateUserProfile.useMutation();

  useEffect(() => {
    setCurrentLanguage(getGoogleTranslateLang());
  }, []);

  const changeLanguage = (langCode: string) => {
    if (langCode === 'en') {
      // Clear Google Translate cookie
      const domain = window.location.hostname;
      document.cookie = `googtrans=; path=/; domain=${domain}; expires=Thu, 01 Jan 1970 00:00:00 UTC`;
      document.cookie = `googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC`;
      const parts = domain.split('.');
      if (parts.length > 2) {
        const root = parts.slice(-2).join('.');
        document.cookie = `googtrans=; path=/; domain=.${root}; expires=Thu, 01 Jan 1970 00:00:00 UTC`;
      }
    } else {
      setGoogleTranslateLang(langCode);
    }
    setCurrentLanguage(langCode);
    // Persist preference server-side so the choice follows the user across
    // devices. Fire-and-forget; failures are silent because the cookie above
    // already takes effect immediately.
    if (isAuthenticated) {
      updateProfile.mutate({ preferredLanguage: langCode });
    }
    window.location.reload();
  };

  const getCurrentLanguage = () => {
    const current = languages.find((lang) => lang.code === currentLanguage);
    return current || languages[0];
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 notranslate">
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">{getCurrentLanguage().flag}</span>
          <span className="hidden md:inline">{getCurrentLanguage().name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="notranslate max-h-72 overflow-y-auto">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => changeLanguage(language.code)}
            className="cursor-pointer"
          >
            <span className="mr-2">{language.flag}</span>
            <span className="flex-1">{language.name}</span>
            {currentLanguage === language.code && (
              <Check className="h-4 w-4 ml-2" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
