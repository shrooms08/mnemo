import { useReducer } from 'react'
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { initialWizardState, wizardReducer, type WizardContext } from './state'

function Breadcrumb() {
  const { pathname } = useLocation()
  let here = 'Seal a new message'
  if (pathname === '/new/configure') here = 'Who and when'
  else if (pathname === '/new/seal') here = 'Seal'

  return (
    <div className="breadcrumb">
      <Link to="/messages" className="link-quiet">
        Your messages
      </Link>
      <span className="sep">/</span>
      {here === 'Seal a new message' ? (
        <span className="here">{here}</span>
      ) : (
        <>
          <Link to="/new/capture" className="link-quiet">
            Seal a new message
          </Link>
          <span className="sep">/</span>
          <span className="here">{here}</span>
        </>
      )}
    </div>
  )
}

export function NewMessageWizard() {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState)
  const navigate = useNavigate()

  return (
    <>
      <header className="app-header">
        <span className="wordmark">
          Mn<em>e</em>mo
        </span>
        <Breadcrumb />
        <button
          className="icon-close"
          type="button"
          aria-label="Close"
          onClick={() => navigate('/messages')}
        />
      </header>
      <Outlet context={{ state, dispatch } satisfies WizardContext} />
    </>
  )
}
