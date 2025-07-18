import React, { useState, useEffect, useCallback } from "react";
// Removed: import { createClient } from '@supabase/supabase-js'; // Will load from CDN

// Supabase Configuration
// Replace with your actual Supabase URL and anon key
const SUPABASE_URL = 'https://mrgydkfteuduanauupok.supabase.co';
// Ensure this key is safe to be exposed on the client-side (anon public key)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZ3lka2Z0ZXVkdWFuYXV1cG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NTI3MzQsImV4cCI6MjA2ODQyODczNH0.8slzpX0PvcPEXy8mqJZwJushmi9_kocGRt9-fot2aVk'; // Corrected typo: exY3Ai to exp

// Cloudinary upload preset (replace with your own if different)
const CLOUDINARY_UPLOAD_PRESET = "docs_unsigned";
// Cloudinary cloud name (replace with your own if different)
const CLOUDINARY_CLOUD_NAME = "dbj9qw0co";

// Supabase client will be initialized inside useEffect after CDN loads
let supabase = null;

function App() {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [sharingDoc, setSharingDoc] = useState(null);
  const [shareeUserId, setShareeUserId] = useState("");

  // Initialize Supabase Auth and handle user ID
  useEffect(() => {
    // Check if Supabase client is available from CDN
    if (window.supabase && !supabase) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("Supabase client initialized from CDN.");
    }

    const setupAuth = async () => {
      if (!supabase) {
        console.error("Supabase client not initialized.");
        setMessage("Supabase client not ready. Please ensure CDN loaded correctly.");
        setShowModal(true);
        setLoading(false);
        return;
      }

      try {
        // Attempt to get the current session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Supabase Auth: Error getting session:", error.message);
          setMessage(`Authentication error: ${error.message}`);
          setShowModal(true);
        }

        if (session) {
          setUserId(session.user.id);
          console.log("Supabase Auth: User signed in with UID:", session.user.id);
        } else {
          console.log("Supabase Auth: No user session found, attempting anonymous sign-in.");
          // Supabase's signInAnonymously creates a user in auth.users
          const { data, error: signInError } = await supabase.auth.signInAnonymously();
          if (signInError) {
            console.error("Supabase Auth: Error during anonymous sign-in:", signInError.message);
            // Specifically check for the "Anonymous sign-ins are disabled" message
            if (signInError.message.includes("Anonymous sign-ins are disabled")) {
              setMessage("Anonymous sign-ins are disabled in your Supabase project. Please enable it in your Supabase project settings under 'Authentication' -> 'Settings' to allow document uploads and sharing. Until then, the app's full functionality will be limited.");
            } else {
              setMessage(`Authentication failed: ${signInError.message}`);
            }
            setShowModal(true);
            setUserId(null); // Ensure userId is null if auth fails
          } else if (data.user) {
            setUserId(data.user.id);
            console.log("Supabase Auth: Signed in anonymously with UID:", data.user.id);
          }
        }
      } catch (error) {
        console.error("Supabase initialization error:", error.message);
        setMessage(`Supabase initialization failed: ${error.message}`);
        setShowModal(true);
      } finally {
        setIsAuthReady(true);
        setLoading(false);
      }
    };

    // Only run setupAuth if Supabase client is available
    if (supabase) {
      setupAuth();
    } else {
      // If not available immediately, wait for the script to load
      const script = document.createElement('script');
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.onload = () => {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase client initialized after CDN script loaded.");
        setupAuth();
      };
      script.onerror = (e) => {
        console.error("Failed to load Supabase CDN script:", e);
        setMessage("Failed to load Supabase library. Check your internet connection or CDN link.");
        setShowModal(true);
        setLoading(false);
      };
      document.head.appendChild(script);
    }


    // Supabase real-time auth state listener
    // This listener needs to be set up after supabase client is guaranteed to be initialized
    let authListenerSubscription;
    if (supabase) {
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('Supabase Auth State Change:', event, session);
            if (session) {
                setUserId(session.user.id);
            } else {
                // User logged out or session expired.
                // For this app, we'll try to re-authenticate anonymously.
                setupAuth();
            }
        });
        authListenerSubscription = authListener.subscription;
    }


    return () => {
      if (authListenerSubscription) {
        authListenerSubscription.unsubscribe();
      }
    };
  }, []);


  // Helper to get the correct table name
  const DOCUMENTS_TABLE = 'documents';

  // Upload to Cloudinary
  const uploadToCloudinary = async (fileToUpload) => {
    const formData = new FormData();
    formData.append("file", fileToUpload);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Cloudinary upload failed");
      }

      console.log("✅ Uploaded to Cloudinary:", data.secure_url);
      return data.secure_url;
    } catch (error) {
      console.error("❌ Cloudinary upload error:", error.message);
      setMessage(`Failed to upload to Cloudinary: ${error.message}`);
      setShowModal(true);
      throw error;
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file to upload.");
      setShowModal(true);
      return;
    }
    if (!userId || !supabase) { // userId must be set from Supabase Auth and supabase client must be ready
      setMessage("App not fully initialized. Please wait.");
      setShowModal(true);
      return;
    }

    setLoading(true);
    try {
      const uploadedUrl = await uploadToCloudinary(file);
      setUrl(uploadedUrl);

      // Supabase: Insert a new row into the 'documents' table
      const { data, error } = await supabase
        .from(DOCUMENTS_TABLE)
        .insert([
          {
            filename: file.name,
            url: uploadedUrl,
            uploadedat: new Date().toISOString(), // Changed from uploadedAt to uploadedat
            ownerid: userId,
            sharedwith: [],
          },
        ])
        .select(); // Select the inserted data to get the ID

      if (error) throw error;

      console.log("✅ Supabase Save Success, Data:", data);
      setFile(null);
      setMessage("Document uploaded successfully!");
      setShowModal(true);
    } catch (error) {
      console.error("❌ Supabase Save Failed:", error.message);
      setMessage(`Failed to save document: ${error.message}`);
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Real-time Supabase listener for documents
  useEffect(() => {
    if (!userId || !isAuthReady || !supabase) return; // Ensure supabase client is ready

    // Supabase Realtime Subscription
    // This subscribes to all changes in the 'documents' table.
    // Row Level Security (RLS) in Supabase will ensure users only see documents
    // they are allowed to see based on your RLS policies.
    const channel = supabase
      .channel('public:documents') // Use a unique channel name
      .on('postgres_changes',
        { event: '*', schema: 'public', table: DOCUMENTS_TABLE },
        (payload) => {
          console.log('Change received!', payload);
          // When a change occurs, re-fetch all documents.
          fetchDocuments();
        }
      )
      .subscribe();

    const fetchDocuments = async () => {
      // Supabase: Fetch documents. RLS policies will filter this on the server.
      const { data, error } = await supabase
        .from(DOCUMENTS_TABLE)
        .select('*');

      if (error) {
        console.error("❌ Supabase fetch error:", error.message);
        setMessage(`Error fetching documents: ${error.message}`);
        setShowModal(true);
        return;
      }

      // Client-side filtering as a fallback/for clarity, though RLS should handle it.
      const filteredDocs = data.filter(docItem =>
        docItem.ownerid === userId || (docItem.sharedwith && docItem.sharedwith.includes(userId))
      );

      setDocs(filteredDocs);
      console.log("Updated documents:", filteredDocs);
    };

    fetchDocuments(); // Initial fetch when component mounts or userId/auth status changes

    return () => {
      channel.unsubscribe(); // Clean up subscription
    };
  }, [userId, isAuthReady, supabase]); // Re-run if userId, auth readiness, or supabase client changes

  const handleDeleteDoc = async (docId, ownerid) => {
    if (!userId || !supabase) {
      setMessage("App not fully initialized. Please wait.");
      setShowModal(true);
      return;
    }
    if (ownerid !== userId) {
      setMessage("You can only delete documents you own.");
      setShowModal(true);
      return;
    }

    setLoading(true);
    try {
      // Supabase: Delete a row
      const { error } = await supabase
        .from(DOCUMENTS_TABLE)
        .delete()
        .eq('id', docId) // Condition to delete the specific document
        .eq('ownerid', userId); // Ensure only owner can delete (additional client-side check)

      if (error) throw error;

      setMessage("Document deleted successfully!");
      setShowModal(true);
    } catch (error) {
      console.error("❌ Error deleting document:", error.message);
      setMessage(`Failed to delete document: ${error.message}`);
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleShareClick = (docToShare) => {
    setSharingDoc(docToShare);
    setShareeUserId(""); // Clear previous sharee
  };

  const handleShareDocument = async () => {
    if (!userId || !sharingDoc || !shareeUserId.trim() || !supabase) {
      setMessage("Invalid sharing details.");
      setShowModal(true);
      return;
    }
    if (sharingDoc.ownerid !== userId) {
      setMessage("You can only share documents you own.");
      setShowModal(true);
      return;
    }
    if (shareeUserId.trim() === userId) {
      setMessage("You cannot share a document with yourself.");
      setShowModal(true);
      return;
    }

    setLoading(true);
    try {
      // Supabase: Update the 'sharedwith' array
      // Fetch current document to get the existing sharedwith array
      const { data: currentDoc, error: fetchError } = await supabase
        .from(DOCUMENTS_TABLE)
        .select('sharedwith')
        .eq('id', sharingDoc.id)
        .single(); // Expect a single row

      if (fetchError) throw fetchError;

      const currentShareWith = currentDoc?.sharedwith || [];
      // Ensure the shareeUserId is a valid UUID for the database schema
      // In a real app, you'd validate if shareeUserId exists in auth.users
      const updatedShareWith = [...new Set([...currentShareWith, shareeUserId.trim()])];

      const { error: updateError } = await supabase
        .from(DOCUMENTS_TABLE)
        .update({ sharedwith: updatedShareWith })
        .eq('id', sharingDoc.id)
        .eq('ownerid', userId); // Ensure owner is updating

      if (updateError) throw updateError;

      setMessage(`Document '${sharingDoc.filename}' shared with '${shareeUserId.trim()}' successfully!`);
      setShowModal(true);
      setSharingDoc(null); // Close sharing modal
      setShareeUserId("");
    } catch (error) {
      console.error("❌ Error sharing document:", error.message);
      setMessage(`Failed to share document: ${error.message}`);
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAccess = async (docId, ownerid, userToRevoke) => {
    if (!userId || !supabase) {
      setMessage("App not fully initialized. Please wait.");
      setShowModal(true);
      return;
    }
    if (ownerid !== userId) {
      setMessage("You can only revoke access for documents you own.");
      setShowModal(true);
      return;
    }

    setLoading(true);
    try {
      // Supabase: Revoke access by removing from 'sharedwith' array
      // Fetch current document to get the existing sharedwith array
      const { data: currentDoc, error: fetchError } = await supabase
        .from(DOCUMENTS_TABLE)
        .select('sharedwith')
        .eq('id', docId)
        .single(); // Expect a single row

      if (fetchError) throw fetchError;

      const currentShareWith = currentDoc?.sharedwith || [];
      const updatedShareWith = currentShareWith.filter(id => id !== userToRevoke);

      const { error: updateError } = await supabase
        .from(DOCUMENTS_TABLE)
        .update({ sharedwith: updatedShareWith })
        .eq('id', docId)
        .eq('ownerid', userId); // Ensure owner is updating

      if (updateError) throw updateError;

      setMessage(`Access revoked for '${userToRevoke}' on document '${docs.find(d => d.id === docId)?.filename}'.`);
      setShowModal(true);
    } catch (error) {
      console.error("❌ Error revoking access:", error.message);
      setMessage(`Failed to revoke access: ${error.message}`);
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };


  // Custom Modal for messages
  const MessageModal = ({ message, onClose }) => {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
          <p className="text-lg font-semibold mb-4">{message}</p>
          <button
            onClick={onClose}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-300"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  // Sharing Modal
  const SharingModal = ({ doc, onClose, onShare, shareeUserId, setShareeUserId }) => {
    if (!doc) return null;
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
          <h3 className="text-xl font-bold mb-4">Share Document: {doc.filename}</h3>
          <div className="mb-4">
            <label htmlFor="shareeId" className="block text-gray-700 text-sm font-bold mb-2">
              Share with User ID:
            </label>
            <input
              type="text"
              id="shareeId"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={shareeUserId}
              onChange={(e) => setShareeUserId(e.target.value)}
              placeholder="Enter User ID (UUID)"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md transition duration-300"
            >
              Cancel
            </button>
            <button
              onClick={onShare}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md transition duration-300"
            >
              Share
            </button>
          </div>
          {doc.sharedwith && doc.sharedwith.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="font-semibold mb-2">Currently Shared With:</h4>
              <ul>
                {doc.sharedwith.map((sharedId, index) => (
                  <li key={index} className="flex items-center justify-between text-sm py-1">
                    <span>{sharedId}</span>
                    {doc.ownerid === userId && (
                      <div className="flex items-center">
                        <button
                          onClick={() => handleRevokeAccess(doc.id, doc.ownerid, sharedId)}
                          className="ml-2 bg-red-500 hover:bg-red-600 text-white text-xs py-1 px-2 rounded-md transition duration-300"
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };


  if (loading && !isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading application...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 font-sans flex flex-col items-center">
      {/* Supabase CDN script */}
      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      <script src="https://cdn.tailwindcss.com"></script>

      {/* Tailwind CSS Configuration */}
      <style>{`
        body { font-family: 'Inter', sans-serif; }
      `}</style>

      {showModal && <MessageModal message={message} onClose={() => setShowModal(false)} />}
      {sharingDoc && (
        <SharingModal
          doc={sharingDoc}
          onClose={() => setSharingDoc(null)}
          onShare={handleShareDocument}
          shareeUserId={shareeUserId}
          setShareeUserId={setShareeUserId}
        />
      )}

      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-3xl mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          ☁️ Cloud Document Storage & Sharing
        </h1>

        {userId && (
          <div className="text-center text-sm text-gray-600 mb-4 p-2 bg-blue-50 rounded-md">
            Your User ID: <span className="font-mono text-blue-700 break-all">{userId}</span>
          </div>
        )}

        <div className="mb-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">📤 Upload Document</h2>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100 mb-4"
          />
          <button
            onClick={handleUpload}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75
              transition duration-300 ease-in-out transform hover:scale-105"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              </span>
            ) : "Upload File"}
          </button>

          {url && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700 break-words">
              <h4 className="font-semibold mb-1">✅ Last Uploaded File URL:</h4>
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {url}
              </a>
            </div>
          )}
        </div>

        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 className="text-2xl font-semibold text-gray-700 mb-4">📂 Your Documents</h3>
          {docs.length === 0 ? (
            <p className="text-gray-600 italic">No documents uploaded or shared with you yet.</p>
          ) : (
            <ul className="space-y-3">
              {docs.map((docItem) => (
                <li
                  key={docItem.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200"
                >
                  <a
                    href={docItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium text-lg flex-grow break-all mb-2 sm:mb-0"
                  >
                    {docItem.filename}
                  </a>
                  <div className="flex flex-wrap gap-2 sm:ml-4">
                    {docItem.ownerid === userId && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleShareClick(docItem)}
                          className="bg-purple-500 hover:bg-purple-600 text-white text-sm py-1 px-3 rounded-md transition duration-300"
                        >
                          Share
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(docItem.id, docItem.ownerid)}
                          className="bg-red-500 hover:bg-red-600 text-white text-sm py-1 px-3 rounded-md transition duration-300"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                    {docItem.ownerid !== userId && (
                      <span className="text-gray-500 text-sm italic">Shared by: {docItem.ownerid}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
