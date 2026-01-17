import CustomerDetail from './pages/CustomerDetail';
import Dashboard from './pages/Dashboard';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import Customers from './pages/Customers';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CustomerDetail": CustomerDetail,
    "Dashboard": Dashboard,
    "Integrations": Integrations,
    "Settings": Settings,
    "Customers": Customers,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};