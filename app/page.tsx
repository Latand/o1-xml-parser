"use client";

export default function HomePage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-4xl font-bold mb-4 text-gray-100">O1 XML Parser</h1>
      <p className="text-lg mb-4 text-gray-300">
        Welcome to the O1 XML Parser utility. This tool helps you manage and
        combine files from your system.
      </p>
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2 text-gray-200">
            Features
          </h2>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>
              <strong className="text-gray-100">File Browser:</strong> Browse
              and combine multiple files from your system
            </li>
            <li>
              <strong className="text-gray-100">Apply Changes:</strong> Apply
              XML changes to your project files
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-2 text-gray-200">
            Getting Started
          </h2>
          <p className="mb-2 text-gray-300">Use the navigation bar above to:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>Browse and combine files using the File Browser</li>
            <li>Apply XML changes to your project using Apply Changes</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
