import { useOutletContext } from 'react-router-dom'
import type { WizardContext } from './state'

export function useWizard(): WizardContext {
  return useOutletContext<WizardContext>()
}
