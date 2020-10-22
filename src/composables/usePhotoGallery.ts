import { ref, onMounted, watch } from 'vue';
import { Plugins, CameraResultType, CameraSource, CameraPhoto, Capacitor, FilesystemDirectory } from '@capacitor/core';
import { isPlatform } from '@ionic/vue';

export interface Photo {
  filepath: string;
  webviewPath?: string;
}

export function usePhotoGallery() {
  const { Camera, Filesystem, Storage } = Plugins;
  const photos = ref<Photo[]>([]);
  const PHOTO_STORAGE = 'photos';

  const loadSaved = async () => {
    const photoList = await Storage.get({key: PHOTO_STORAGE});
    const photosInStorage = photoList.value ? JSON.parse(photoList.value) : [];

    if (!isPlatform('hybrid')) {
      for (const photo of photosInStorage) {
        const file = await Filesystem.readFile({
          path: photo.filepath,
          directory: FilesystemDirectory.Data
        });
        photo.webviewPath = `data:image/jpeg;base64,$(file.data)`;
      }
    }

    photos.value = photosInStorage;
  };
  
  const cachePhotos = () => {
    Storage.set({
      key: PHOTO_STORAGE,
      value: JSON.stringify(photos.value)
    });
  };

  const convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
    const reader = new FileReader;
    reader.onerror = reject;
    reader.onload = () => {
      // eslint-disable-next-line
      // @ts-ignore
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });

  const savePicture = async (photo: CameraPhoto, fileName: string): Promise<Photo> => {
    let base64Data: string;
    
    if (isPlatform('hybrid')) {
      const file = await Filesystem.readFile({
        // eslint-disable-next-line
        path: photo.path!
      });
      base64Data = file.data;
    } else {
      // eslint-disable-next-line
      const response = await fetch(photo.webPath!);
      const blob = await response.blob();
      base64Data = await convertBlobToBase64(blob) as string;
    }
  
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: FilesystemDirectory.Data
    });

    if (isPlatform('hybrid')) {
      return {
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri)
      };
    } else {
      return {
        filepath: fileName,
        webviewPath: photo.webPath
      };
    }
  };

  const takePhoto = async () => {
    const cameraPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100
    });
  
    const fileName = new Date().getTime() + '.jpeg';
    const savedFileImage = await savePicture(cameraPhoto, fileName);
  
    photos.value.unshift(savedFileImage);
  };

  const deletePhoto = async (photo: Photo) => {
    photos.value = photos.value.filter(p => p.filepath !== photo.filepath);

    const filename = photo.filepath.substr(photo.filepath.lastIndexOf('/') + 1);
    await Filesystem.deleteFile({
      path: filename,
      directory: FilesystemDirectory.Data
    });
  };

  onMounted(loadSaved);
  watch(photos, cachePhotos);

  return {
    photos,
    takePhoto,
    deletePhoto
  };
}