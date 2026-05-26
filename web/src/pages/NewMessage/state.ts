export type Plaintext =
  | { kind: 'text'; text: string }
  | { kind: 'audio'; blob: Blob }
  | { kind: 'video'; blob: Blob }

export type WizardState = {
  plaintext: Plaintext | null
  recipient: string
  title: string
  unlockEnabled: boolean
  unlockDateMs: number | null
  deadmanEnabled: boolean
  deadmanDays: number
}

export const initialWizardState: WizardState = {
  plaintext: null,
  recipient: '',
  title: '',
  unlockEnabled: true,
  unlockDateMs: null,
  deadmanEnabled: false,
  deadmanDays: 30,
}

export type WizardAction =
  | { type: 'SET_PLAINTEXT'; payload: Plaintext }
  | { type: 'SET_RECIPIENT'; payload: string }
  | { type: 'SET_TITLE'; payload: string }
  | { type: 'TOGGLE_UNLOCK'; payload: boolean }
  | { type: 'SET_UNLOCK_DATE'; payload: number | null }
  | { type: 'TOGGLE_DEADMAN'; payload: boolean }
  | { type: 'SET_DEADMAN_DAYS'; payload: number }
  | { type: 'RESET' }

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_PLAINTEXT':
      return { ...state, plaintext: action.payload }
    case 'SET_RECIPIENT':
      return { ...state, recipient: action.payload }
    case 'SET_TITLE':
      return { ...state, title: action.payload }
    case 'TOGGLE_UNLOCK':
      return { ...state, unlockEnabled: action.payload }
    case 'SET_UNLOCK_DATE':
      return { ...state, unlockDateMs: action.payload }
    case 'TOGGLE_DEADMAN':
      return { ...state, deadmanEnabled: action.payload }
    case 'SET_DEADMAN_DAYS':
      return { ...state, deadmanDays: action.payload }
    case 'RESET':
      return initialWizardState
  }
}

export type WizardContext = {
  state: WizardState
  dispatch: React.Dispatch<WizardAction>
}
