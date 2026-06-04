import React, { useState, useEffect } from 'react';
import { storage, db } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, listAll } from 'firebase/storage';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { FileUp, File, Download, Loader2, Search } from 'lucide-react';
import { useUser } from '../context/UserContext';

const Documents = () => {
  const { user, getTenantCollection, addLog } = useUser();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!user) return;
    const q = query(getTenantCollection('documents'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, [user]);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const companyId = user?.empresa || 'development';
    const storageRef = ref(storage, `business/${companyId}/docs/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(p);
      }, 
      (error) => {
        console.error(error);
        setUploading(false);
      }, 
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        await addDoc(getTenantCollection('documents'), {
          name: file.name,
          url: url,
          size: (file.size / 1024).toFixed(2) + ' KB',
          type: file.type,
          createdAt: new Date().toISOString()
        });
        addLog(`fez o upload do arquivo ${file.name}`);
        setUploading(false);
        setProgress(0);
      }
    );
  };

  return (
    <div className="documents-page">
      <header>
        <div>
          <h1>Central de Documentos</h1>
          <p className="text-muted">Armazene contratos, propostas e arquivos do projeto.</p>
        </div>
        <label className="btn-primary flex items-center gap-2 cursor-pointer">
          {uploading ? <Loader2 className="animate-spin" size={20} /> : <FileUp size={20} />}
          {uploading ? `Enviando ${progress.toFixed(0)}%` : 'Upload de Arquivo'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {files.map(file => (
          <div key={file.id} className="card flex flex-col justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <File size={24} />
              </div>
              <div className="flex-1 overflow-hidden">
                <h3 className="font-semibold truncate" title={file.name}>{file.name}</h3>
                <p className="text-sm text-muted">{file.size} • {new Date(file.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t flex justify-end">
              <a 
                href={file.url} 
                target="_blank" 
                rel="noreferrer"
                onClick={() => addLog(`baixou o arquivo ${file.name}`)}
                className="flex items-center gap-2 text-primary font-semibold hover:underline"
              >
                <Download size={18} /> Baixar
              </a>
            </div>
          </div>
        ))}
        {files.length === 0 && !uploading && (
          <div className="col-span-full py-20 text-center card bg-slate-50 border-dashed">
            <p className="text-muted">Nenhum documento armazenado.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Documents;
