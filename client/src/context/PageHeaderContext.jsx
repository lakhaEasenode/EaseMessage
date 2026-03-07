import { createContext, useContext, useState } from 'react';

const PageHeaderContext = createContext(null);

export const PageHeaderProvider = ({ children }) => {
    const [header, setHeader] = useState({ title: '', subtitle: null, actions: null });

    return (
        <PageHeaderContext.Provider value={{ header, setHeader }}>
            {children}
        </PageHeaderContext.Provider>
    );
};

export const usePageHeader = () => useContext(PageHeaderContext);

export default PageHeaderContext;
