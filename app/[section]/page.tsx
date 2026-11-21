import {notFound} from 'next/navigation';
import Workspace from '../workspace';
export default async function Page({params}:{params:Promise<{section:string}>}){
 const {section}=await params;
 if(!['dashboard','premarket','execution','playbooks','journal','analytics','competition','settings','onboarding','login'].includes(section))notFound();
 return <Workspace section={section}/>;
}
