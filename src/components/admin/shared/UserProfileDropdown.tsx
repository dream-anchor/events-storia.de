import { useState, useEffect } from "react";
import { useLogout, useGetIdentity } from "@refinedev/core";
import { LogOut, ChevronDown, User, Mail, Check, X, Pencil, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAdminDisplayName, getAdminInitials, isKnownAdmin } from "@/lib/adminDisplayNames";

const getInitials = (name?: string, email?: string) => {
  if (name && !name.includes('@')) {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  // Use central registry for known admins
  if (email && isKnownAdmin(email)) {
    return getAdminInitials(email);
  }
  // Fallback to first letter of email
  return email?.[0]?.toUpperCase() || 'A';
};

const getDisplayName = (email?: string, providedName?: string) => {
  // Check if provided name is actually a name (not an email)
  if (providedName && !providedName.includes('@')) {
    return providedName;
  }
  // Use central registry for known admins
  if (email && isKnownAdmin(email)) {
    return getAdminDisplayName(email);
  }
  // Fallback: extract name from email
  if (email) {
    const localPart = email.split('@')[0];
    return localPart
      .replace(/[._-]/g, ' ')
      .replace(/\d+/g, '')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
      .trim() || email;
  }
  return 'Benutzer';
};

export function UserProfileDropdown() {
  const { mutate: logout } = useLogout();
  const { data: identity, refetch: refetchIdentity } = useGetIdentity<{ email: string; name?: string }>();
  
  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [customName, setCustomName] = useState<string | null>(null);
  
  // Email editing state
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmail, setEditedEmail] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  
  const displayName = customName || getDisplayName(identity?.email, identity?.name);
  const initials = getInitials(displayName, identity?.email);
  
  // Load custom name from localStorage on mount
  useEffect(() => {
    if (identity?.email) {
      const stored = localStorage.getItem(`admin_display_name_${identity.email}`);
      if (stored) setCustomName(stored);
    }
  }, [identity?.email]);
  
  // Name editing handlers
  const handleStartEditName = () => {
    setEditedName(displayName);
    setIsEditingName(true);
  };
  
  const handleSaveName = () => {
    if (editedName.trim()) {
      setCustomName(editedName.trim());
      if (identity?.email) {
        localStorage.setItem(`admin_display_name_${identity.email}`, editedName.trim());
      }
      toast.success('Name aktualisiert');
    }
    setIsEditingName(false);
  };
  
  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditedName('');
  };
  
  // Email editing handlers
  const handleStartEditEmail = () => {
    setEditedEmail(identity?.email || '');
    setIsEditingEmail(true);
  };
  
  const handleSaveEmail = async () => {
    if (!editedEmail.trim() || editedEmail === identity?.email) {
      setIsEditingEmail(false);
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editedEmail.trim())) {
      toast.error('Ungültige E-Mail-Adresse');
      return;
    }
    
    setIsEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: editedEmail.trim(),
      });
      
      if (error) throw error;
      
      toast.success('Bestätigungs-E-Mail gesendet', {
        description: 'Bitte bestätige die neue E-Mail-Adresse über den Link in der E-Mail.',
      });
      setIsEditingEmail(false);
      // Refetch identity after a delay to get updated email
      setTimeout(() => refetchIdentity(), 2000);
    } catch (error: any) {
      console.error('Email update error:', error);
      toast.error('Fehler beim Aktualisieren', {
        description: error.message || 'E-Mail konnte nicht geändert werden.',
      });
    } finally {
      setIsEmailLoading(false);
    }
  };
  
  const handleCancelEditEmail = () => {
    setIsEditingEmail(false);
    setEditedEmail('');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 rounded-2xl px-2.5 h-10 hover:bg-accent/50 font-sans"
          >
            <Avatar className="h-8 w-8 border border-border/50">
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-sm font-semibold font-sans">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden lg:block text-sm font-medium max-w-[140px] truncate font-sans">
              {displayName}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
          </Button>
        </motion.div>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-72 p-0 overflow-hidden font-sans"
        sideOffset={8}
      >
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-muted/50 to-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-base font-semibold font-sans">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0 space-y-1">
              {/* Editable Name */}
              {/* Editable Name */}
              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="h-7 text-sm font-medium px-2"
                    placeholder="Dein Name"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') handleCancelEditName();
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary hover:text-primary shrink-0"
                    onClick={handleSaveName}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-muted-foreground shrink-0"
                    onClick={handleCancelEditName}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div 
                  className="flex items-center gap-1.5 group cursor-pointer hover:bg-accent/30 -mx-1 px-1 py-0.5 rounded transition-colors"
                  onClick={handleStartEditName}
                >
                  <span className="font-medium text-foreground truncate">
                    {displayName}
                  </span>
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              )}
              
              {/* Editable Email */}
              {isEditingEmail ? (
                <div className="flex items-center gap-1 mt-1">
                  <Input
                    type="email"
                    value={editedEmail}
                    onChange={(e) => setEditedEmail(e.target.value)}
                    className="h-7 text-xs px-2"
                    placeholder="neue@email.de"
                    autoFocus
                    disabled={isEmailLoading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEmail();
                      if (e.key === 'Escape') handleCancelEditEmail();
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary hover:text-primary shrink-0"
                    onClick={handleSaveEmail}
                    disabled={isEmailLoading}
                  >
                    {isEmailLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-muted-foreground shrink-0"
                    onClick={handleCancelEditEmail}
                    disabled={isEmailLoading}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div 
                  className="flex items-center gap-1.5 text-xs text-muted-foreground group cursor-pointer hover:bg-accent/30 -mx-1 px-1 py-0.5 rounded transition-colors"
                  onClick={handleStartEditEmail}
                >
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{identity?.email}</span>
                  <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              )}
            </div>
          </div>
        </div>
        
        <DropdownMenuSeparator className="m-0" />
        
        {/* Quick Info */}
        <div className="p-2">
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span>Administrator</span>
          </div>
        </div>
        
        <DropdownMenuSeparator className="m-0" />
        
        {/* Actions */}
        <div className="p-1">
          <DropdownMenuItem 
            onClick={() => logout()}
            className="text-foreground focus:text-foreground focus:bg-accent/10 cursor-pointer gap-2 py-2.5"
          >
            <LogOut className="h-4 w-4" />
            Abmelden
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
