import { useState } from 'react';
import { Settings, Save, Bell, Palette, Shield, Users } from 'lucide-react';

export function TaskSettings() {
  const [notifyOnAssign, setNotifyOnAssign] = useState(true);
  const [notifyOnDue, setNotifyOnDue] = useState(true);
  const [notifyOnComplete, setNotifyOnComplete] = useState(false);
  const [theme, setTheme] = useState('amber');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <Settings className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-amber-100 mt-1">Manage your task preferences</p>
          </div>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="grid gap-6">
        {/* Notifications */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-amber-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Bell className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">Notifications</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">Task Assignment</p>
                <p className="text-sm text-gray-500">Get notified when a task is assigned to you</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOnAssign}
                  onChange={(e) => setNotifyOnAssign(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">Due Date Reminders</p>
                <p className="text-sm text-gray-500">Get reminded before task deadlines</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOnDue}
                  onChange={(e) => setNotifyOnDue(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">Task Completion</p>
                <p className="text-sm text-gray-500">Get notified when team tasks are completed</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOnComplete}
                  onChange={(e) => setNotifyOnComplete(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-amber-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Palette className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">Appearance</h2>
          </div>

          <div className="space-y-4">
            <div>
              <p className="font-medium text-gray-800 mb-3">Theme Color</p>
              <div className="flex gap-3">
                {['amber', 'blue', 'green', 'purple'].map((color) => (
                  <button
                    key={color}
                    onClick={() => setTheme(color)}
                    className={`w-10 h-10 rounded-full transition-all ${
                      color === 'amber' ? 'bg-amber-500' :
                      color === 'blue' ? 'bg-blue-500' :
                      color === 'green' ? 'bg-green-500' :
                      'bg-purple-500'
                    } ${theme === color ? 'ring-4 ring-offset-2 ring-gray-300' : ''}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Access Control */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-amber-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Shield className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">Access Control</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-amber-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="font-medium text-gray-800">Role-Based Access</p>
                  <p className="text-sm text-gray-500">Access permissions are managed based on your user role</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Contact your administrator to modify access permissions.
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium hover:from-amber-600 hover:to-orange-600 transition-colors flex items-center gap-2">
          <Save className="w-5 h-5" />
          Save Settings
        </button>
      </div>
    </div>
  );
}
