import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './lib/wagmi'
import { WalletProvider } from './context/WalletContext'
import { NavBar } from './components/NavBar'
import { Footer } from './components/Footer'
import { Home } from './routes/Home'
import { Dashboard } from './routes/Dashboard'
import { Sandbox } from './routes/Sandbox'
import { Terms } from './routes/Terms'
import { Privacy } from './routes/Privacy'

const queryClient = new QueryClient()

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <WalletProvider>
            <div className="min-h-screen flex flex-col">
              <NavBar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/app" element={<Dashboard />} />
                  <Route path="/sandbox" element={<Sandbox />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/privacy" element={<Privacy />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </WalletProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
