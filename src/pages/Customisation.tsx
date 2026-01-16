import React, { useState } from 'react'

const Customisation = () => {
    const [customisationList, setCustomisationList] = useState([
        { id: 1, name: 'Custom Label Design', category: 'Labeling', status: 'Completed' },
        { id: 2, name: 'Packaging Color Variant', category: 'Packaging', status: 'In Progress' },
        { id: 3, name: 'Fragrance Custom Blend', category: 'Formulation', status: 'Pending' },
    ])

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Customisation</h1>
                    <p className="text-gray-600">Manage product customisations and special requests</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-gray-600 text-sm font-semibold mb-2">Total Requests</h3>
                        <p className="text-3xl font-bold text-amber-600">{customisationList.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-gray-600 text-sm font-semibold mb-2">Completed</h3>
                        <p className="text-3xl font-bold text-green-600">1</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-gray-600 text-sm font-semibold mb-2">In Progress</h3>
                        <p className="text-3xl font-bold text-blue-600">1</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-gray-600 text-sm font-semibold mb-2">Pending</h3>
                        <p className="text-3xl font-bold text-red-600">1</p>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-gray-800">Customisation Requests</h2>
                        <button className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700">
                            + New Request
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-100 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Category</th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customisationList.map((item) => (
                                    <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                                        <td className="px-6 py-4 text-gray-900 font-medium">{item.name}</td>
                                        <td className="px-6 py-4 text-gray-600">{item.category}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                item.status === 'Completed'
                                                    ? 'bg-green-100 text-green-800'
                                                    : item.status === 'In Progress'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button className="text-blue-600 hover:text-blue-800 text-sm mr-4">View</button>
                                            <button className="text-blue-600 hover:text-blue-800 text-sm mr-4">Edit</button>
                                            <button className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Customisation
