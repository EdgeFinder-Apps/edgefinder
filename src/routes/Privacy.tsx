export function Privacy() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-40 -right-40 w-96 h-96 bg-sky-400/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-400/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 gradient-text">Privacy Policy</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Your privacy and data protection are important to us
          </p>
        </div>
        
        <div className="card p-8 sm:p-12 space-y-8 text-gray-700 dark:text-gray-300">
        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">1. Information We Collect</h2>
          <p className="mb-3">
            Our service is designed with privacy in mind. We collect minimal information:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Your wallet address when you connect</li>
            <li>Transaction data related to your $1 USDC payments</li>
            <li>Anonymous usage data to improve the service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">2. How We Use Your Information</h2>
          <p className="mb-3">
            The information we collect is used to:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Provide and maintain our service</li>
            <li>Process your payments</li>
            <li>Improve user experience</li>
            <li>Detect and prevent fraud or abuse</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">3. Data Storage</h2>
          <p>
            Your fetched datasets are stored locally in your browser using localStorage. We do not store your 
            market data on our servers. Your wallet address may be logged for payment verification purposes.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">4. Third-Party Services</h2>
          <p className="mb-3">
            Our service integrates with third-party platforms:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Polymarket and Kalshi APIs for market data</li>
            <li>Arbitrum network for payment processing</li>
            <li>Web3 wallet providers for authentication</li>
          </ul>
          <p className="mt-3">
            Please review the privacy policies of these third parties as they have their own data practices.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">5. Cookies and Tracking</h2>
          <p>
            We use localStorage to remember your theme preference and store your dataset. We do not use tracking 
            cookies or sell your data to third parties.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">6. Data Security</h2>
          <p>
            We implement reasonable security measures to protect your information. However, no method of transmission 
            over the Internet or electronic storage is 100% secure. All blockchain transactions are public by nature.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">7. Your Rights</h2>
          <p className="mb-3">
            You have the right to:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Disconnect your wallet at any time</li>
            <li>Clear your local data by clearing browser storage</li>
            <li>Request information about data we may have collected</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">8. Changes to This Policy</h2>
          <p>
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the 
            new Privacy Policy on this page with an updated "Last updated" date.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">9. Contact</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us through our GitHub repository 
            or community channels.
          </p>
        </section>

        <div className="pt-4 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          Last updated: November 2025
        </div>
        </div>
      </div>
    </div>
  )
}
