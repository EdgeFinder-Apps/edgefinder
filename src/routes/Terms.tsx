export function Terms() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-40 -right-40 w-96 h-96 bg-sky-400/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-400/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 gradient-text">Terms of Service</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Please read these terms carefully before using our service
          </p>
        </div>
        
        <div className="card p-8 sm:p-12 space-y-8 text-gray-700 dark:text-gray-300">
        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">1. Acceptance of Terms</h2>
          <p>
            By accessing and using this prediction market arbitrage finder service, you accept and agree to be bound 
            by the terms and provision of this agreement.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">2. Use License</h2>
          <p>
            This service provides information about potential arbitrage opportunities between prediction markets. 
            The data is provided "as is" without any guarantees of accuracy or profitability.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">3. Disclaimer</h2>
          <p className="mb-3">
            The information provided by this service does not constitute financial advice. Users should:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Conduct their own research before making any trades</li>
            <li>Understand the risks involved in prediction markets</li>
            <li>Be aware that market conditions can change rapidly</li>
            <li>Consider transaction fees and slippage in their calculations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">4. Payment</h2>
          <p>
            Access to refreshed data requires a payment of $1 USDC on Arbitrum. Payments are non-refundable. 
            The service may experience downtime or data delays beyond our control.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">5. Limitations</h2>
          <p>
            In no event shall the service or its suppliers be liable for any damages arising out of the use or 
            inability to use the materials on this service, even if authorized representative has been notified 
            of the possibility of such damage.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">6. Modifications</h2>
          <p>
            We may revise these terms of service at any time without notice. By using this service you are agreeing 
            to be bound by the then current version of these terms of service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">7. Governing Law</h2>
          <p>
            These terms and conditions are governed by and construed in accordance with applicable laws and you 
            irrevocably submit to the exclusive jurisdiction of the courts in that location.
          </p>
        </section>
        </div>
      </div>
    </div>
  )
}
