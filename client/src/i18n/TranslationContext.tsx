import React, { createContext, useContext, useEffect, useMemo, ReactNode } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import en from './translations/en'
import zhTW from './translations/zh-tw'

type TranslationStrings = Record<string, string | { name: string; category: string }[]>

export const SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh-tw', label: '繁體中文' },
] as const

const translations: Record<string, TranslationStrings> = { en, 'zh-tw': zhTW }
const LOCALES: Record<string, string> = { en: 'en-US', 'zh-tw': 'zh-TW' }
const RTL_LANGUAGES = new Set<string>([])

export function getLocaleForLanguage(language: string): string {
  return LOCALES[language] || LOCALES.en
}

export function getIntlLanguage(language: string): string {
  if (language === 'zh-tw') return 'zh-TW'
  return 'en'
}

export function isRtlLanguage(language: string): boolean {
  return RTL_LANGUAGES.has(language)
}

interface TranslationContextValue {
  t: (key: string, params?: Record<string, string | number>) => string
  language: string
  locale: string
}

const TranslationContext = createContext<TranslationContextValue>({ t: (k: string) => k, language: 'en', locale: 'en-US' })

interface TranslationProviderProps {
  children: ReactNode
}

export function TranslationProvider({ children }: TranslationProviderProps) {
  const language = useSettingsStore((s) => s.settings.language) || 'en'

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = isRtlLanguage(language) ? 'rtl' : 'ltr'
  }, [language])

  const value = useMemo((): TranslationContextValue => {
    const strings = translations[language] || translations.en
    const fallback = translations.en

    function t(key: string, params?: Record<string, string | number>): string {
      let val: string = (strings[key] ?? fallback[key] ?? key) as string
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          val = val.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        })
      }
      return val
    }

    return { t, language, locale: getLocaleForLanguage(language) }
  }, [language])

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>
}

export function useTranslation(): TranslationContextValue {
  return useContext(TranslationContext)
}
