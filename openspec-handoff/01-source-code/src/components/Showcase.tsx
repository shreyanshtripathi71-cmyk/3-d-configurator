export default function Showcase() {
  return (
    <section className="py-24 bg-gray-light">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-secondary font-semibold text-sm uppercase tracking-wider">
            Our Software
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-dark mt-2 mb-4">
            See Newkore in{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary to-yellow-400">
              Action
            </span>
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            A powerful, intuitive interface your team will love using every day.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Screenshot 1 - Configurator */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200/50">
            <div className="bg-dark px-4 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-3 text-gray-400 text-xs">
                configurator.newkore.com
              </span>
            </div>
            <div className="p-6">
              <div className="flex gap-4 mb-4">
                <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                  Windows
                </div>
                <div className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-sm">
                  Doors
                </div>
                <div className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-sm">
                  Garage
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Width</div>
                    <div className="bg-white rounded h-8 border border-gray-200" />
                  </div>
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Height</div>
                    <div className="bg-white rounded h-8 border border-gray-200" />
                  </div>
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Glass Type</div>
                    <div className="bg-white rounded h-8 border border-gray-200" />
                  </div>
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Frame Color</div>
                    <div className="flex gap-2 mt-1">
                      <div className="w-6 h-6 rounded-full bg-gray-800 ring-2 ring-primary ring-offset-2" />
                      <div className="w-6 h-6 rounded-full bg-white border border-gray-300" />
                      <div className="w-6 h-6 rounded-full bg-amber-700" />
                      <div className="w-6 h-6 rounded-full bg-gray-400" />
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center">
                  <div className="w-24 h-32 border-4 border-gray-800 rounded-sm bg-blue-200/50 relative">
                    <div className="absolute inset-2 border border-gray-400 rounded-sm" />
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-400" />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between bg-green-50 rounded-lg p-3">
                <span className="text-sm text-gray-600">Estimated Price</span>
                <span className="text-2xl font-bold text-green-600">$847.00</span>
              </div>
            </div>
          </div>

          {/* Screenshot 2 - Dashboard */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200/50">
            <div className="bg-dark px-4 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-3 text-gray-400 text-xs">
                dashboard.newkore.com
              </span>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-bold text-dark">Dealer Dashboard</h4>
                <div className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-sm font-medium">
                  This Month
                </div>
              </div>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-primary">1,247</div>
                  <div className="text-xs text-gray-500">Quotes</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-secondary">$2.4M</div>
                  <div className="text-xs text-gray-500">Revenue</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">89%</div>
                  <div className="text-xs text-gray-500">Win Rate</div>
                </div>
              </div>
              {/* Chart mockup */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-3">Monthly Revenue</div>
                <div className="flex items-end gap-2 h-24">
                  {[40, 55, 45, 70, 60, 80, 65, 90, 75, 95, 85, 100].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-gradient-to-t from-primary to-cyan-400 transition-all"
                        style={{ height: `${h}%` }}
                      />
                    )
                  )}
                </div>
              </div>
              {/* Recent orders */}
              <div className="mt-4 space-y-2">
                {[
                  { name: "ABC Windows Co.", amount: "$12,450", status: "Completed" },
                  { name: "Metro Doors LLC", amount: "$8,200", status: "Processing" },
                  { name: "GaragePro Inc.", amount: "$5,780", status: "Pending" },
                ].map((order, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <span className="text-sm text-gray-700">{order.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{order.amount}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          order.status === "Completed"
                            ? "bg-green-100 text-green-700"
                            : order.status === "Processing"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
