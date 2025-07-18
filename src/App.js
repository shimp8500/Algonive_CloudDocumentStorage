import React, { useState, useEffect, useCallback } from "react";
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  query,
  where
} from "firebase/firestore";

// Cloudinary upload preset (replace with your own if different)
const CLOUDINARY_UPLOAD_PRESET = "docs_unsigned";
// Cloudinary cloud name (replace with your own if different)
const CLOUDINARY_CLOUD_NAME = "dbj9qw0co";

function App() {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [sharingDoc, setSharingDoc] = useState(null);
  const [shareeUserId, setShareeUserId] = useState("");

  // Initialize Firebase and handle authentication
  useEffect(() => {
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

      if (Object.keys(firebaseConfig).length === 0) {
        console.error("Firebase config is missing. Please ensure __firebase_config is provided.");
        setMessage("Firebase configuration is missing. Cannot initialize app.");
        setShowModal(true);
        setLoading(false);
        return;
      }

      const app = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
          console.log("Firebase Auth: User signed in with UID:", user.uid);
        } else {
          console.log("Firebase Auth: No user signed in, attempting anonymous sign-in.");
          try {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
              await signInWithCustomToken(firebaseAuth, __initial_auth_token);
              console.log("Firebase Auth: Signed in with custom token.");
            } else {
              await signInAnonymously(firebaseAuth);
              console.log("Firebase Auth: Signed in anonymously.");
            }
          } catch (error) {
            console.error("Firebase Auth: Error during sign-in:", error.message);
            setMessage(`Authentication failed: ${error.message}`);
            setShowModal(true);
          }
        }
        setIsAuthReady(true);
        setLoading(false);
      });

      return () => unsubscribeAuth();
    } catch (error) {
      console.error("Firebase initialization error:", error.message);
      setMessage(`Firebase initialization failed: ${error.message}`);
      setShowModal(true);
      setLoading(false);
    }
  }, []);

  // Helper to get the correct collection path
  const getDocumentsCollectionRef = useCallback(() => {
    if (!db || !userId) return null;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    // Store public data under /artifacts/{appId}/public/data/documents
    return collection(db, `artifacts/${appId}/public/data/documents`);
  }, [db, userId]);

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
    if (!db || !userId) {
      setMessage("App not fully initialized. Please wait.");
      setShowModal(true);
      return;
    }

    setLoading(true);
    try {
      const uploadedUrl = await uploadToCloudinary(file);
      setUrl(uploadedUrl);

      const docRef = await addDoc(getDocumentsCollectionRef(), {
        fileName: file.name,
        url: uploadedUrl,
        uploadedAt: serverTimestamp(),
        ownerId: userId, // Store the ID of the user who uploaded the document
        sharedWith: [], // Array of user IDs this document is shared with
      });

      console.log("✅ Firestore Save Success, ID:", docRef.id);
      setFile(null);
      setMessage("Document uploaded successfully!");
      setShowModal(true);
    } catch (error) {
      console.error("❌ Firestore Save Failed:", error.message);
      setMessage(`Failed to save document: ${error.message}`);
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Real-time Firestore listener for documents owned by or shared with the current user
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;

    const documentsCollectionRef = getDocumentsCollectionRef();
    if (!documentsCollectionRef) return;

    // Create a query that listens for documents owned by the current user
    // OR documents where the current user's ID is in the 'sharedWith' array.
    // Firestore does not directly support OR queries across different fields.
    // We'll fetch all public documents and filter them client-side for simplicity,
    // or use two separate listeners and merge the results.
    // For a more scalable solution, consider denormalizing data or using Cloud Functions.

    // For now, let's just listen to all documents in the public collection
    // and filter client-side for display. This might become inefficient with many documents.
    // A better approach for "sharedWith" would be to create a subcollection or a separate
    // collection for shared documents, or use two separate queries.

    // For simplicity, we'll fetch all documents and filter for owner or shared access.
    // Note: This approach might fetch more data than necessary if there are many public documents.
    const unsubscribe = onSnapshot(
      documentsCollectionRef,
      (snapshot) => {
        const docsData = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .filter(docItem => {
            // Only show documents owned by the current user or shared with the current user
            return docItem.ownerId === userId || (docItem.sharedWith && docItem.sharedWith.includes(userId));
          });
        setDocs(docsData);
        console.log("Updated documents:", docsData);
      },
      (error) => {
        console.error("❌ Firestore snapshot error:", error.message);
        setMessage(`Error fetching documents: ${error.message}`);
        setShowModal(true);
      }
    );

    return () => unsubscribe();
  }, [db, userId, isAuthReady, getDocumentsCollectionRef]);

  const handleDeleteDoc = async (docId, ownerId) => {
    if (!db || !userId) {
      setMessage("App not fully initialized. Please wait.");
      setShowModal(true);
      return;
    }
    if (ownerId !== userId) {
      setMessage("You can only delete documents you own.");
      setShowModal(true);
      return;
    }

    setLoading(true);
    try {
      const docRef = doc(getDocumentsCollectionRef(), docId);
      await deleteDoc(docRef);
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
    if (!db || !userId || !sharingDoc || !shareeUserId.trim()) {
      setMessage("Invalid sharing details.");
      setShowModal(true);
      return;
    }
    if (sharingDoc.ownerId !== userId) {
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
      const docRef = doc(getDocumentsCollectionRef(), sharingDoc.id);
      await updateDoc(docRef, {
        sharedWith: arrayUnion(shareeUserId.trim()),
      });
      setMessage(`Document '${sharingDoc.fileName}' shared with '${shareeUserId.trim()}' successfully!`);
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

  const handleRevokeAccess = async (docId, ownerId, userToRevoke) => {
    if (!db || !userId) {
      setMessage("App not fully initialized. Please wait.");
      setShowModal(true);
      return;
    }
    if (ownerId !== userId) {
      setMessage("You can only revoke access for documents you own.");
      setShowModal(true);
      return;
    }

    setLoading(true);
    try {
      const docRef = doc(getDocumentsCollectionRef(), docId);
      await updateDoc(docRef, {
        sharedWith: arrayRemove(userToRevoke),
      });
      setMessage(`Access revoked for '${userToRevoke}' on document '${docs.find(d => d.id === docId)?.fileName}'.`);
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
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
          <h3 className="text-xl font-bold mb-4">Share Document: {doc.fileName}</h3>
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
              placeholder="Enter User ID"
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
          {doc.sharedWith && doc.sharedWith.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="font-semibold mb-2">Currently Shared With:</h4>
              <ul>
                {doc.sharedWith.map((sharedId, index) => (
                  <li key={index} className="flex items-center justify-between text-sm py-1">
                    <span>{sharedId}</span>
                    {doc.ownerId === userId && ( // Only owner can revoke
                      <button
                        onClick={() => handleRevokeAccess(doc.id, doc.ownerId, sharedId)}
                        className="ml-2 bg-red-500 hover:bg-red-600 text-white text-xs py-1 px-2 rounded-md transition duration-300"
                      >
                        Revoke
                      </button>
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
                    {docItem.fileName}
                  </a>
                  <div className="flex flex-wrap gap-2 sm:ml-4">
                    {docItem.ownerId === userId && (
                      <>
                        <button
                          onClick={() => handleShareClick(docItem)}
                          className="bg-purple-500 hover:bg-purple-600 text-white text-sm py-1 px-3 rounded-md transition duration-300"
                        >
                          Share
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(docItem.id, docItem.ownerId)}
                          className="bg-red-500 hover:bg-red-600 text-white text-sm py-1 px-3 rounded-md transition duration-300"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {docItem.ownerId !== userId && (
                      <span className="text-gray-500 text-sm italic">Shared by: {docItem.ownerId}</span>
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
