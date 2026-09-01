import { notFound } from 'next/navigation'

import { Contact } from '@/components/sections/Contact'
import { Cinema } from '@/components/sections/Cinema'
import { Manifesto } from '@/components/sections/Manifesto'
import { Process } from '@/components/sections/Process'
import { Work } from '@/components/sections/Work'
import { isLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

/** Project data is revalidated hourly once the work section lands. */
export const revalidate = 3600

export default async function Page(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)

  return (
    <>
      <Cinema
        dict={dict.work}
        hero={dict.hero}
        calendar={dict.calendar}
        deskIndex={dict.deskIndex}
      />
      <Work dict={dict.work} label={dict.nav.items.work} />
      <Manifesto dict={dict.manifesto} about={dict.about} label={dict.nav.items.manifesto} />
      <Process dict={dict.process} label={dict.nav.items.process} />
      <Contact dict={dict.contact} locale={locale} label={dict.nav.items.contact} />
    </>
  )
}
