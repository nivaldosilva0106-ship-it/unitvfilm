import { getAllContents, updateContent, type Content } from './firebase';
import { toast } from 'sonner';

export const exportContent = async (categories: string[]) => {
    try {
        const allContent = await getAllContents();
        const filteredContent = allContent.filter(c => categories.includes(c.category));

        if (filteredContent.length === 0) {
            toast.error("Nenhum conteúdo encontrado para as categorias selecionadas.");
            return;
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredContent, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `unitv_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();

        toast.success(`${filteredContent.length} itens exportados com sucesso!`);
    } catch (error) {
        console.error("Erro ao exportar:", error);
        toast.error("Erro ao exportar conteúdo.");
    }
};

export const importContent = async (file: File) => {
    return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (!Array.isArray(json)) {
                    throw new Error("O arquivo não contém uma lista válida de conteúdos.");
                }

                let successCount = 0;
                let errorCount = 0;

                const loadingToast = toast.loading("Importando conteúdo...");

                for (const item of json) {
                    if (item.id && item.category) {
                        // Ensure we are sending a valid Content object partial
                        await updateContent(item.id, item as Content);
                        successCount++;
                    } else {
                        errorCount++;
                    }
                }

                toast.dismiss(loadingToast);

                if (successCount > 0) {
                    toast.success(`${successCount} itens importados/atualizados com sucesso!`);
                }
                if (errorCount > 0) {
                    toast.warning(`${errorCount} itens falharam (formato inválido).`);
                }
                resolve();
            } catch (error) {
                console.error("Erro ao importar:", error);
                toast.error("Erro ao processar o arquivo. Verifique se é um JSON válido.");
                resolve(); // Resolve anyway to stop loading states if any
            }
        };
        reader.onerror = (error) => {
            toast.error("Erro ao ler o arquivo.");
            resolve();
        };
        reader.readAsText(file);
    });
};
