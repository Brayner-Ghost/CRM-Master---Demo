import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

/**
 * Faz o download de um arquivo fiscal (XML/PDF) da FocusNFE e salva no Firebase Storage
 */
export const saveFiscalToStorage = async (saleId, url, type = 'xml') => {
  if (!url) return null;
  
  try {
    // Tenta buscar o arquivo. Nota: Pode falhar por CORS dependendo da configuração da FocusNFE
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Falha ao baixar ${type}: ${response.statusText}`);
    
    const blob = await response.blob();
    const extension = type === 'xml' ? 'xml' : 'pdf';
    const filePath = `fiscal/${saleId}/${type}_${Date.now()}.${extension}`;
    const storageRef = ref(storage, filePath);
    
    const snapshot = await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    
    return downloadUrl;
  } catch (error) {
    console.error(`Erro ao salvar ${type} no Storage:`, error);
    // Se falhar (ex: CORS), retornamos a URL original para não perder o dado
    return url;
  }
};
