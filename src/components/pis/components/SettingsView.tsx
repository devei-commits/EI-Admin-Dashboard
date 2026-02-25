import { useState, useEffect } from 'react';
import { Settings, Bell, Shield, Palette, Database, Globe, Lock, User, Moon, Sun, Users, Key, Server, Workflow, BarChart3, FileText } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { usePIS } from '../context/PISContext';
import { UserRole } from '../types/pis';
import { getRolePermissions } from '../utils/permissions';

interface SettingsViewProps {
 currentRole: UserRole;
}

const getInitialSettings = (storageKey: string) => {
 const defaults = {
  // General
  language: 'en',
  timezone: 'UTC+5:30',
  dateFormat: 'DD/MM/YYYY',
  // Notifications
  emailNotifications: true,
  pushNotifications: true,
  taskReminders: true,
  statusUpdates: true,
  weeklyDigest: false,
  // Display
  theme: 'light',
  compactMode: false,
  showAnimations: true,
  // Privacy
  profileVisible: true,
  activityVisible: false,
  twoFactorAuth: false,
  // Workflow (for managers)
  autoAssignTasks: false,
  defaultAssignee: '',
  // System (for admins)
  sessionTimeout: 30,
  maxLoginAttempts: 5,
  enableAuditLog: true,
 };

 if (typeof window === 'undefined') return defaults;
 try {
  const stored = localStorage.getItem(storageKey);
  if (stored) {
   const parsed = JSON.parse(stored);
   return { ...defaults, ...parsed };
  }
 } catch (e) {
  console.error('Error reading stored settings:', e);
 }
 return defaults;
};

export function SettingsView({ currentRole }: SettingsViewProps) {
 const { currentUser } = usePIS();
 const permissions = getRolePermissions(currentRole);
 
 // Settings state
 const storageKey = currentUser ? `pis_user_settings_${currentUser.id}` : 'pis_user_settings_anonymous';
 const [settings, setSettings] = useState<Record<string, any>>(() => getInitialSettings(storageKey));

 useEffect(() => {
  setSettings(getInitialSettings(storageKey));
 }, [storageKey]);

 const handleSettingChange = (key: string, value: any) => {
  setSettings((prev: Record<string, any>) => {
   const updated = { ...prev, [key]: value };
   if (typeof window !== 'undefined') {
    localStorage.setItem(storageKey, JSON.stringify(updated));
   }
   return updated;
  });
  toast.success('Setting updated successfully');
 };

 const handleSaveAll = () => {
  if (typeof window !== 'undefined') {
   localStorage.setItem(storageKey, JSON.stringify(settings));
  }
  toast.success('All settings saved successfully');
 };

 // Determine which tabs to show based on role
 const showGeneralTab = true; // All roles can see general settings
 const showNotificationsTab = true; // All roles can configure notifications
 const showDisplayTab = true; // All roles can configure display
 const showPrivacyTab = true; // All roles can configure privacy
 const showWorkflowTab = permissions.canManageTasks || permissions.canAssignTerminate; // Managers and leads
 const showSystemTab = permissions.canManageUsers || currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN'; // Admins only

 return (
  <div className="space-y-6">
   <div>
    <h2 className="text-3xl font-bold text-gray-900 mb-2">Settings</h2>
    <p className="text-gray-600">
     {currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' 
      ? 'Configure system settings and user preferences'
      : 'Configure your preferences and workflow settings'}
    </p>
   </div>

   <Tabs defaultValue="general" className="space-y-6">
    <TabsList className="bg-white border">
     {showGeneralTab && (
      <TabsTrigger value="general" className="flex items-center gap-2">
       <Settings className="h-4 w-4" />
       General
      </TabsTrigger>
     )}
     {showNotificationsTab && (
      <TabsTrigger value="notifications" className="flex items-center gap-2">
       <Bell className="h-4 w-4" />
       Notifications
      </TabsTrigger>
     )}
     {showDisplayTab && (
      <TabsTrigger value="display" className="flex items-center gap-2">
       <Palette className="h-4 w-4" />
       Display
      </TabsTrigger>
     )}
     {showPrivacyTab && (
      <TabsTrigger value="privacy" className="flex items-center gap-2">
       <Shield className="h-4 w-4" />
       Privacy
      </TabsTrigger>
     )}
     {showWorkflowTab && (
      <TabsTrigger value="workflow" className="flex items-center gap-2">
       <Workflow className="h-4 w-4" />
       Workflow
      </TabsTrigger>
     )}
     {showSystemTab && (
      <TabsTrigger value="system" className="flex items-center gap-2">
       <Server className="h-4 w-4" />
       System
      </TabsTrigger>
     )}
    </TabsList>

    {/* General Settings - Available to all roles */}
    {showGeneralTab && (
     <TabsContent value="general">
      <Card className="p-6">
       <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <Globe className="h-5 w-5 text-blue-600" />
        General Settings
       </h3>
       
       <div className="space-y-6">
        {/* Profile Section */}
        <div className="p-4 bg-gray-50 rounded-lg">
         <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
          <User className="h-4 w-4" />
          Profile Information
         </h4>
         <div className="grid gap-4 md:grid-cols-2">
          <div>
           <Label htmlFor="name">Full Name</Label>
           <Input 
            id="name" 
            defaultValue={currentUser?.name || ''} 
            className="mt-1"
            disabled={!permissions.canViewSettings}
           />
          </div>
          <div>
           <Label htmlFor="email">Email Address</Label>
           <Input 
            id="email" 
            defaultValue={currentUser?.email || ''} 
            disabled 
            className="mt-1 bg-gray-100" 
           />
          </div>
          <div>
           <Label htmlFor="department">Department</Label>
           <Input 
            id="department" 
            defaultValue={currentUser?.department || 'Not specified'} 
            className="mt-1"
            disabled={!permissions.canViewSettings}
           />
          </div>
          <div>
           <Label htmlFor="role">Role</Label>
           <Input 
            id="role" 
            defaultValue={currentRole || 'Not assigned'} 
            disabled 
            className="mt-1 bg-gray-100" 
           />
          </div>
         </div>
        </div>

        {/* Regional Settings */}
        <div className="grid gap-6 md:grid-cols-3">
         <div className="space-y-2">
          <Label>Language</Label>
          <Select 
           value={settings.language} 
           onValueChange={(v) => handleSettingChange('language', v)}
           disabled={!permissions.canViewSettings}
          >
           <SelectTrigger>
            <SelectValue />
           </SelectTrigger>
           <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="hi">Hindi</SelectItem>
            <SelectItem value="ta">Tamil</SelectItem>
            <SelectItem value="te">Telugu</SelectItem>
            <SelectItem value="kn">Kannada</SelectItem>
           </SelectContent>
          </Select>
         </div>

         <div className="space-y-2">
          <Label>Timezone</Label>
          <Select 
           value={settings.timezone} 
           onValueChange={(v) => handleSettingChange('timezone', v)}
           disabled={!permissions.canViewSettings}
          >
           <SelectTrigger>
            <SelectValue />
           </SelectTrigger>
           <SelectContent>
            <SelectItem value="UTC+5:30">IST (UTC+5:30)</SelectItem>
            <SelectItem value="UTC">UTC</SelectItem>
            <SelectItem value="UTC+8">SGT (UTC+8)</SelectItem>
            <SelectItem value="UTC+1">CET (UTC+1)</SelectItem>
            <SelectItem value="UTC-5">EST (UTC-5)</SelectItem>
           </SelectContent>
          </Select>
         </div>

         <div className="space-y-2">
          <Label>Date Format</Label>
          <Select 
           value={settings.dateFormat} 
           onValueChange={(v) => handleSettingChange('dateFormat', v)}
           disabled={!permissions.canViewSettings}
          >
           <SelectTrigger>
            <SelectValue />
           </SelectTrigger>
           <SelectContent>
            <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
            <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
            <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
           </SelectContent>
          </Select>
         </div>
        </div>
       </div>
      </Card>
     </TabsContent>
    )}

    {/* Notification Settings - Available to all roles */}
    {showNotificationsTab && (
     <TabsContent value="notifications">
      <Card className="p-6">
       <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <Bell className="h-5 w-5 text-blue-600" />
        Notification Preferences
       </h3>
       
       <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
         <div className="space-y-0.5">
          <Label className="text-base">Email Notifications</Label>
          <p className="text-sm text-gray-500">Receive notifications via email</p>
         </div>
         <Switch
          checked={settings.emailNotifications}
          onCheckedChange={(v) => handleSettingChange('emailNotifications', v)}
          disabled={!permissions.canViewSettings}
         />
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
         <div className="space-y-0.5">
          <Label className="text-base">Push Notifications</Label>
          <p className="text-sm text-gray-500">Receive browser push notifications</p>
         </div>
         <Switch
          checked={settings.pushNotifications}
          onCheckedChange={(v) => handleSettingChange('pushNotifications', v)}
          disabled={!permissions.canViewSettings}
         />
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
         <div className="space-y-0.5">
          <Label className="text-base">Task Reminders</Label>
          <p className="text-sm text-gray-500">
           {permissions.canManageTasks 
            ? 'Get reminded about upcoming task deadlines and assignments'
            : 'Get reminded about your upcoming task deadlines'}
          </p>
         </div>
         <Switch
          checked={settings.taskReminders}
          onCheckedChange={(v) => handleSettingChange('taskReminders', v)}
          disabled={!permissions.canViewSettings}
         />
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
         <div className="space-y-0.5">
          <Label className="text-base">Status Updates</Label>
          <p className="text-sm text-gray-500">Notify when PIS status changes</p>
         </div>
         <Switch
          checked={settings.statusUpdates}
          onCheckedChange={(v) => handleSettingChange('statusUpdates', v)}
          disabled={!permissions.canViewSettings}
         />
        </div>

        {permissions.canManageTasks && (
         <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="space-y-0.5">
           <Label className="text-base">Assignment Notifications</Label>
           <p className="text-sm text-gray-500">Notify when tasks are assigned to your team</p>
          </div>
          <Switch
           checked={settings.assignmentNotifications || false}
           onCheckedChange={(v) => handleSettingChange('assignmentNotifications', v)}
           disabled={!permissions.canViewSettings}
          />
         </div>
        )}

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
         <div className="space-y-0.5">
          <Label className="text-base">Weekly Digest</Label>
          <p className="text-sm text-gray-500">Receive a weekly summary of activities</p>
         </div>
         <Switch
          checked={settings.weeklyDigest}
          onCheckedChange={(v) => handleSettingChange('weeklyDigest', v)}
          disabled={!permissions.canViewSettings}
         />
        </div>
       </div>
      </Card>
     </TabsContent>
    )}

    {/* Display Settings - Available to all roles */}
    {showDisplayTab && (
     <TabsContent value="display">
      <Card className="p-6">
       <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <Palette className="h-5 w-5 text-blue-600" />
        Display Settings
       </h3>
       
       <div className="space-y-6">
        <div className="p-4 bg-gray-50 rounded-lg">
         <Label className="text-base mb-4 block">Theme</Label>
         <div className="flex gap-4">
          <button
           onClick={() => handleSettingChange('theme', 'light')}
           disabled={!permissions.canViewSettings}
           className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
            settings.theme === 'light' 
             ? 'border-blue-500 bg-blue-50' 
             : 'border-gray-200 hover:border-gray-300'
           } ${!permissions.canViewSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
           <Sun className="h-5 w-5" />
           <span>Light</span>
          </button>
          <button
           onClick={() => handleSettingChange('theme', 'dark')}
           disabled={!permissions.canViewSettings}
           className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
            settings.theme === 'dark' 
             ? 'border-blue-500 bg-blue-50' 
             : 'border-gray-200 hover:border-gray-300'
           } ${!permissions.canViewSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
           <Moon className="h-5 w-5" />
           <span>Dark</span>
          </button>
         </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
         <div className="space-y-0.5">
          <Label className="text-base">Compact Mode</Label>
          <p className="text-sm text-gray-500">Use a more condensed layout</p>
         </div>
         <Switch
          checked={settings.compactMode}
          onCheckedChange={(v) => handleSettingChange('compactMode', v)}
          disabled={!permissions.canViewSettings}
         />
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
         <div className="space-y-0.5">
          <Label className="text-base">Show Animations</Label>
          <p className="text-sm text-gray-500">Enable UI animations and transitions</p>
         </div>
         <Switch
          checked={settings.showAnimations}
          onCheckedChange={(v) => handleSettingChange('showAnimations', v)}
          disabled={!permissions.canViewSettings}
         />
        </div>
       </div>
      </Card>
     </TabsContent>
    )}

    {/* Privacy Settings - Available to all roles */}
    {showPrivacyTab && (
     <TabsContent value="privacy">
      <Card className="p-6">
       <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <Shield className="h-5 w-5 text-blue-600" />
        Privacy & Security
       </h3>
       
       <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
         <div className="space-y-0.5">
          <Label className="text-base">Profile Visibility</Label>
          <p className="text-sm text-gray-500">Allow other users to see your profile</p>
         </div>
         <Switch
          checked={settings.profileVisible}
          onCheckedChange={(v) => handleSettingChange('profileVisible', v)}
          disabled={!permissions.canViewSettings}
         />
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
         <div className="space-y-0.5">
          <Label className="text-base">Activity Visibility</Label>
          <p className="text-sm text-gray-500">Show your recent activity to others</p>
         </div>
         <Switch
          checked={settings.activityVisible}
          onCheckedChange={(v) => handleSettingChange('activityVisible', v)}
          disabled={!permissions.canViewSettings}
         />
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
         <div className="space-y-0.5">
          <Label className="text-base flex items-center gap-2">
           <Lock className="h-4 w-4 text-slate-800" />
           Two-Factor Authentication
          </Label>
          <p className="text-sm text-slate-900">Add an extra layer of security to your account</p>
         </div>
         <Switch
          checked={settings.twoFactorAuth}
          onCheckedChange={(v) => handleSettingChange('twoFactorAuth', v)}
          disabled={!permissions.canViewSettings}
         />
        </div>

        {(currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'CLIENT') && (
         <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <h4 className="font-medium text-red-900 mb-2">Danger Zone</h4>
          <p className="text-sm text-red-700 mb-3">
           These actions are irreversible. Please proceed with caution.
          </p>
          <div className="flex gap-3">
           <Button 
            variant="outline" 
            className="text-red-600 border-red-300 hover:bg-red-50"
            disabled={!permissions.canViewSettings}
           >
            Export My Data
           </Button>
           {currentRole !== 'CLIENT' && (
            <Button 
             variant="destructive" 
             className="bg-red-600 hover:bg-red-700"
             disabled={!permissions.canViewSettings}
            >
             Delete Account
            </Button>
           )}
          </div>
         </div>
        )}
       </div>
      </Card>
     </TabsContent>
    )}

    {/* Workflow Settings - For Managers and Leads */}
    {showWorkflowTab && (
     <TabsContent value="workflow">
      <Card className="p-6">
       <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <Workflow className="h-5 w-5 text-blue-600" />
        Workflow Settings
       </h3>
       
       <div className="space-y-6">
        {permissions.canManageTasks && (
         <>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
           <div className="space-y-0.5">
            <Label className="text-base">Auto-Assign Tasks</Label>
            <p className="text-sm text-gray-500">
             Automatically assign new tasks to team members based on workload
            </p>
           </div>
           <Switch
            checked={settings.autoAssignTasks}
            onCheckedChange={(v) => handleSettingChange('autoAssignTasks', v)}
            disabled={!permissions.canViewSettings}
           />
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
           <Label className="text-base mb-2 block">Default Task Assignee</Label>
           <Select 
            value={settings.defaultAssignee} 
            onValueChange={(v) => handleSettingChange('defaultAssignee', v)}
            disabled={!permissions.canViewSettings || !settings.autoAssignTasks}
           >
            <SelectTrigger>
             <SelectValue placeholder="Select default assignee" />
            </SelectTrigger>
            <SelectContent>
             <SelectItem value="none">None (Manual Assignment)</SelectItem>
             <SelectItem value="self">Assign to Me</SelectItem>
             <SelectItem value="round-robin">Round Robin</SelectItem>
             <SelectItem value="least-busy">Least Busy Team Member</SelectItem>
            </SelectContent>
           </Select>
          </div>
         </>
        )}

        {permissions.canAssignTerminate && (
         <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-4 flex items-center gap-2">
           <FileText className="h-4 w-4" />
           PIS Management
          </h4>
          <div className="space-y-4">
           <div className="flex items-center justify-between">
            <div className="space-y-0.5">
             <Label className="text-base">Auto-Advance Stages</Label>
             <p className="text-sm text-blue-700">Automatically move PIS to next stage when all checks are complete</p>
            </div>
            <Switch
             checked={settings.autoAdvanceStages || false}
             onCheckedChange={(v) => handleSettingChange('autoAdvanceStages', v)}
             disabled={!permissions.canViewSettings}
            />
           </div>
           <div className="flex items-center justify-between">
            <div className="space-y-0.5">
             <Label className="text-base">Require Approval for Termination</Label>
             <p className="text-sm text-blue-700">Require confirmation before terminating PIS</p>
            </div>
            <Switch
             checked={settings.requireTerminationApproval !== false}
             onCheckedChange={(v) => handleSettingChange('requireTerminationApproval', v)}
             disabled={!permissions.canViewSettings}
            />
           </div>
          </div>
         </div>
        )}

        {permissions.canViewAnalytics && (
         <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <h4 className="font-medium text-purple-900 mb-4 flex items-center gap-2">
           <BarChart3 className="h-4 w-4" />
           Analytics & Reporting
          </h4>
          <div className="space-y-4">
           <div className="flex items-center justify-between">
            <div className="space-y-0.5">
             <Label className="text-base">Auto-Generate Reports</Label>
             <p className="text-sm text-purple-700">Automatically generate weekly/monthly reports</p>
            </div>
            <Switch
             checked={settings.autoGenerateReports || false}
             onCheckedChange={(v) => handleSettingChange('autoGenerateReports', v)}
             disabled={!permissions.canViewSettings}
            />
           </div>
           <div className="space-y-2">
            <Label>Report Frequency</Label>
            <Select 
             value={settings.reportFrequency || 'weekly'} 
             onValueChange={(v) => handleSettingChange('reportFrequency', v)}
             disabled={!permissions.canViewSettings}
            >
             <SelectTrigger>
              <SelectValue />
             </SelectTrigger>
             <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
             </SelectContent>
            </Select>
           </div>
          </div>
         </div>
        )}
       </div>
      </Card>
     </TabsContent>
    )}

    {/* System Settings - For Admins Only */}
    {showSystemTab && (
     <TabsContent value="system">
      <Card className="p-6">
       <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <Server className="h-5 w-5 text-blue-600" />
        System Settings
       </h3>
       
       <div className="space-y-6">
        {/* Security Settings */}
        <div className="p-4 bg-gray-50 rounded-lg">
         <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Security Configuration
         </h4>
         <div className="space-y-4">
          <div className="space-y-2">
           <Label>Session Timeout (minutes)</Label>
           <Input
            type="number"
            value={settings.sessionTimeout}
            onChange={(e) => handleSettingChange('sessionTimeout', parseInt(e.target.value))}
            min={5}
            max={480}
            disabled={!permissions.canManageUsers}
           />
           <p className="text-sm text-gray-500">Users will be logged out after this period of inactivity</p>
          </div>
          <div className="space-y-2">
           <Label>Max Login Attempts</Label>
           <Input
            type="number"
            value={settings.maxLoginAttempts}
            onChange={(e) => handleSettingChange('maxLoginAttempts', parseInt(e.target.value))}
            min={3}
            max={10}
            disabled={!permissions.canManageUsers}
           />
           <p className="text-sm text-gray-500">Account will be locked after this many failed login attempts</p>
          </div>
          <div className="flex items-center justify-between">
           <div className="space-y-0.5">
            <Label className="text-base">Enable Audit Logging</Label>
            <p className="text-sm text-gray-500">Log all system activities for compliance and security</p>
           </div>
           <Switch
            checked={settings.enableAuditLog}
            onCheckedChange={(v) => handleSettingChange('enableAuditLog', v)}
            disabled={!permissions.canManageUsers}
           />
          </div>
         </div>
        </div>

        {/* User Management */}
        {permissions.canManageUsers && (
         <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
           <Users className="h-4 w-4" />
           User Management
          </h4>
          <div className="space-y-4">
           <div className="flex items-center justify-between">
            <div className="space-y-0.5">
             <Label className="text-base">Allow User Self-Registration</Label>
             <p className="text-sm text-gray-500">Allow new users to register themselves</p>
            </div>
            <Switch
             checked={settings.allowSelfRegistration || false}
             onCheckedChange={(v) => handleSettingChange('allowSelfRegistration', v)}
            />
           </div>
           <div className="flex items-center justify-between">
            <div className="space-y-0.5">
             <Label className="text-base">Require Email Verification</Label>
             <p className="text-sm text-gray-500">Require users to verify their email before activation</p>
            </div>
            <Switch
             checked={settings.requireEmailVerification !== false}
             onCheckedChange={(v) => handleSettingChange('requireEmailVerification', v)}
            />
           </div>
           <div className="flex items-center justify-between">
            <div className="space-y-0.5">
             <Label className="text-base">Default User Role</Label>
             <p className="text-sm text-gray-500">Default role assigned to new users</p>
            </div>
            <Select 
             value={settings.defaultUserRole || 'BD_STAFF'} 
             onValueChange={(v) => handleSettingChange('defaultUserRole', v)}
            >
             <SelectTrigger className="w-48">
              <SelectValue />
             </SelectTrigger>
             <SelectContent>
              <SelectItem value="BD_STAFF">BD Staff</SelectItem>
              <SelectItem value="RND_STAFF">R&D Staff</SelectItem>
              <SelectItem value="QA_STAFF">QA Staff</SelectItem>
              <SelectItem value="PKG_STAFF">Packaging Staff</SelectItem>
              <SelectItem value="CLIENT">Client</SelectItem>
             </SelectContent>
            </Select>
           </div>
          </div>
         </div>
        )}

        {/* Database & Backup */}
        {currentRole === 'SUPER_ADMIN' && (
         <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
           <Database className="h-4 w-4" />
           Database & Backup
          </h4>
          <div className="space-y-4">
           <div className="flex items-center justify-between">
            <div className="space-y-0.5">
             <Label className="text-base">Auto Backup</Label>
             <p className="text-sm text-gray-500">Automatically backup database daily</p>
            </div>
            <Switch
             checked={settings.autoBackup !== false}
             onCheckedChange={(v) => handleSettingChange('autoBackup', v)}
            />
           </div>
           <div className="space-y-2">
            <Label>Backup Retention (days)</Label>
            <Input
             type="number"
             value={settings.backupRetention || 30}
             onChange={(e) => handleSettingChange('backupRetention', parseInt(e.target.value))}
             min={7}
             max={365}
            />
           </div>
           <div className="flex gap-3">
            <Button variant="outline">
             <Database className="h-4 w-4 mr-2" />
             Create Backup Now
            </Button>
            <Button variant="outline">
             <Key className="h-4 w-4 mr-2" />
             Restore from Backup
            </Button>
           </div>
          </div>
         </div>
        )}
       </div>
      </Card>
     </TabsContent>
    )}
   </Tabs>

   {/* Save Button */}
   {permissions.canViewSettings && (
    <div className="flex justify-end">
     <Button onClick={handleSaveAll} className="px-8">
      Save All Settings
     </Button>
    </div>
   )}
  </div>
 );
}
