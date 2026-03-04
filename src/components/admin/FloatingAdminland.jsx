import React, { useState, useEffect } from 'react';
import { client } from '@/api/client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { Shield } from 'lucide-react';

export default function FloatingAdminland() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await client.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to load user', error);
      }
    };
    loadUser();
  }, []);

  // Only show for admin users
  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <Link to={createPageUrl('Adminland')}>
      <button
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-purple-500 hover:bg-purple-600 text-white shadow-lg flex items-center justify-center z-50 transition-all"
      >
        <Shield className="w-6 h-6" />
      </button>
    </Link>
  );
}