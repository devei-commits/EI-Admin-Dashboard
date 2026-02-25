import { useEffect, useState, useRef } from 'react';
import { MessageCircle, Send, Edit2, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { usePIS } from '../context/PISContext';
import { pisApi } from '../utils/api';
import { toast } from 'sonner';

interface PISMessage {
 id: string;
 message: string;
 createdAt: string;
 updatedAt: string;
 isEdited: boolean;
 editedAt?: string;
 author: {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string | null;
 };
}

interface PISChatProps {
 pisId: string;
 currentRole: string;
 disabled?: boolean;
}

export function PISChat({ pisId, currentRole, disabled = false }: PISChatProps) {
 const { currentUser } = usePIS();
 const [messages, setMessages] = useState<PISMessage[]>([]);
 const [newMessage, setNewMessage] = useState('');
 const [isLoading, setIsLoading] = useState(false);
 const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
 const [editText, setEditText] = useState('');
 const messagesEndRef = useRef<HTMLDivElement>(null);
 const [isSending, setIsSending] = useState(false);

 const scrollToBottom = () => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 };

 const fetchMessages = async () => {
  try {
   setIsLoading(true);
   const response = await pisApi.getMessages(pisId);
   if (response.success && response.data) {
    setMessages(response.data);
    setTimeout(scrollToBottom, 100);
   }
  } catch (error: any) {
   console.error('Error fetching messages:', error);
   toast.error('Failed to load messages');
  } finally {
   setIsLoading(false);
  }
 };

 useEffect(() => {
  if (pisId) {
   fetchMessages();
  }
 }, [pisId]);

 useEffect(() => {
  scrollToBottom();
 }, [messages]);

 const handleSendMessage = async () => {
  if (!newMessage.trim() || isSending) return;

  try {
   setIsSending(true);
   const response = await pisApi.createMessage(pisId, newMessage.trim());
   if (response.success && response.data) {
    setMessages([...messages, response.data]);
    setNewMessage('');
    scrollToBottom();
   }
  } catch (error: any) {
   console.error('Error sending message:', error);
   toast.error('Failed to send message');
  } finally {
   setIsSending(false);
  }
 };

 const handleEditMessage = async (messageId: string) => {
  if (!editText.trim()) return;

  try {
   const response = await pisApi.updateMessage(pisId, messageId, editText.trim());
   if (response.success && response.data) {
    setMessages(messages.map(msg => 
     msg.id === messageId ? response.data : msg
    ));
    setEditingMessageId(null);
    setEditText('');
   }
  } catch (error: any) {
   console.error('Error updating message:', error);
   toast.error('Failed to update message');
  }
 };

 const handleDeleteMessage = async (messageId: string) => {
  if (!confirm('Are you sure you want to delete this message?')) return;

  try {
   const response = await pisApi.deleteMessage(pisId, messageId);
   if (response.success) {
    setMessages(messages.filter(msg => msg.id !== messageId));
    toast.success('Message deleted');
   }
  } catch (error: any) {
   console.error('Error deleting message:', error);
   toast.error('Failed to delete message');
  }
 };

 const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { 
   month: 'short', 
   day: 'numeric',
   year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
 };

 const getAuthorName = (author: PISMessage['author']) => {
  if (author.firstName || author.lastName) {
   return `${author.firstName || ''} ${author.lastName || ''}`.trim();
  }
  return author.email;
 };

 const canEditOrDelete = (message: PISMessage) => {
  if (!currentUser) return false;
  if (currentRole === 'ADMIN' || currentRole === 'SUPER_ADMIN') return true;
  return message.author.id.toString() === currentUser.id || 
      message.author.id === parseInt(currentUser.id);
 };

 return (
  <Card className="p-4">
   <div className="flex items-center gap-2 mb-4">
    <MessageCircle className="h-5 w-5 text-blue-600" />
    <h3 className="font-medium">Team Chat</h3>
    <Badge variant="secondary">{messages.length}</Badge>
   </div>

   {/* Messages List */}
   <div className="border rounded-lg bg-gray-50 p-4 mb-4 max-h-96 overflow-y-auto space-y-3">
    {isLoading ? (
     <div className="text-center text-gray-500 py-8">Loading messages...</div>
    ) : messages.length === 0 ? (
     <div className="text-center text-gray-500 py-8">
      <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
      <p>No messages yet. Start the conversation!</p>
     </div>
    ) : (
     messages.map((message) => {
      const isOwnMessage = currentUser && (
       message.author.id.toString() === currentUser.id || 
       message.author.id === parseInt(currentUser.id)
      );
      
      return (
      <div
       key={message.id}
       className={`p-3 rounded-lg ${
        isOwnMessage
         ? 'bg-blue-100 ml-8'
         : 'bg-white mr-8'
       }`}
      >
       {editingMessageId === message.id ? (
        <div className="space-y-2">
         <Textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="min-h-[80px]"
          autoFocus
         />
         <div className="flex gap-2 justify-end">
          <Button
           variant="outline"
           size="sm"
           onClick={() => {
            setEditingMessageId(null);
            setEditText('');
           }}
          >
           Cancel
          </Button>
          <Button
           size="sm"
           onClick={() => handleEditMessage(message.id)}
           disabled={!editText.trim()}
          >
           Save
          </Button>
         </div>
        </div>
       ) : (
        <>
         <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1">
           <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">
             {getAuthorName(message.author)}
            </span>
            {message.author.role && (
             <Badge variant="outline" className="text-xs">
              {message.author.role}
             </Badge>
            )}
            <span className="text-xs text-gray-500">
             {formatTimestamp(message.createdAt)}
            </span>
            {message.isEdited && (
             <span className="text-xs text-gray-400 italic">(edited)</span>
            )}
           </div>
           <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {message.message}
           </p>
          </div>
          {canEditOrDelete(message) && !disabled && (
           <div className="flex gap-1">
            <Button
             variant="ghost"
             size="sm"
             className="h-6 w-6 p-0"
             onClick={() => {
              setEditingMessageId(message.id);
              setEditText(message.message);
             }}
             title="Edit message"
            >
             <Edit2 className="h-3 w-3" />
            </Button>
            <Button
             variant="ghost"
             size="sm"
             className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
             onClick={() => handleDeleteMessage(message.id)}
             title="Delete message"
            >
             <Trash2 className="h-3 w-3" />
            </Button>
           </div>
          )}
         </div>
        </>
       )}
      </div>
      );
     })
    )}
    <div ref={messagesEndRef} />
   </div>

   {/* Message Input */}
   {!disabled && (
    <div className="space-y-2">
     <Textarea
      value={newMessage}
      onChange={(e) => setNewMessage(e.target.value)}
      placeholder="Type your message..."
      className="min-h-[80px]"
      onKeyDown={(e) => {
       if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
       }
      }}
     />
     <div className="flex justify-end">
      <Button
       onClick={handleSendMessage}
       disabled={!newMessage.trim() || isSending}
       className="gap-2"
      >
       <Send className="h-4 w-4" />
       {isSending ? 'Sending...' : 'Send Message'}
      </Button>
     </div>
    </div>
   )}
  </Card>
 );
}
