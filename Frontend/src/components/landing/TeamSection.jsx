import React from 'react';
import { Github, Linkedin } from 'lucide-react';

const TEAM_MEMBERS = [
    { name: "Duniya Vasa", role: "Group Lead", team: "Coordination", image: "/team/duniya_vasa.jpg", linkedin: "https://www.linkedin.com/in/duniyavasa/", github: "https://github.com/Duniya-24" },
    { name: "Sowjanya N", role: "Member", team: "Coordination", image: "/team/sowjanya_n.jpg", linkedin: "https://www.linkedin.com/in/sowjanya-n-962319354", github: "https://github.com/Sowji0118/" },
    { name: "Pragati Tiwari", role: "Lead", team: "Model", image: "/team/pragati_tiwari.jpg", linkedin: "https://linkedin.com/in/pragati-tiwari-608b043b5", github: "https://github.com/pTIWARI-20" },
    { name: "Shaik Eshak", role: "Member", team: "Model", image: "/team/shaik_eshak.jpg", linkedin: "https://www.linkedin.com/in/eshak-s-16738626a/", github: "https://github.com/Eshakshai" },
    { name: "Ippili Raju", role: "Member", team: "Model", image: "/team/ippili_raju.jpg", linkedin: "https://www.linkedin.com/in/raju-ippili-419051308/", github: "https://github.com/raju-ippili" },
    { name: "Vinitha Giri", role: "Member", team: "Model", image: "/team/vinitha_giri.jpg", linkedin: "https://www.linkedin.com/in/vinitha-giri/", github: "https://github.com/vinitha-giri" },
    { name: "Asna Abdul Kareem", role: "Member", team: "Model", image: "/team/asna_abdul_kareem.jpg", linkedin: "https://in.linkedin.com/in/asna-abdul-kareem-6774a6292", github: "https://github.com/Asnaabdul" },
    { name: "Ritesh Bonthalakoti", role: "Member", team: "Model", image: "/team/ritesh_bonthalakoti.jpg", linkedin: "https://www.linkedin.com/in/ritesh1908", github: "https://github.com/ritesh-1918" },
    { name: "Asmeet Kaur Makkad", role: "Lead", team: "Backend", image: "/team/asmeet_kaur_makkad.jpg", linkedin: "https://www.linkedin.com/in/asmeet-kaur-makkad-911bb3304", github: "https://github.com/AsmeetKaurMakkad" },
    { name: "Vijayalakshmi S R", role: "Member", team: "Backend", image: "/team/vijayalakshmi_s_r.jpg", linkedin: "https://www.linkedin.com/in/vijayalakshmi-s-r-6a260228a/", github: "https://github.com/Vijayalakshmi1412" },
    { name: "Dinesh Reddy Vasampelli", role: "Member", team: "Backend", image: "/team/dinesh_reddy_vasampelli.jpg", linkedin: "https://www.linkedin.com/in/dineshreddy-vasampelli-b11046296/", github: "https://github.com/vasampellidineshreddy18-bot" },
    { name: "Manya Sahasra", role: "Member", team: "Backend", image: "/team/manya_sahasra.jpg", linkedin: "https://www.linkedin.com/in/manya2929", github: "https://github.com/ManyaSaaha9" },
    { name: "Satla Prayukthika", role: "Lead", team: "Frontend", image: "/team/satla_prayukthika.jpg", linkedin: "https://www.linkedin.com/in/satla-prayukthika-328114291/", github: "https://github.com/prayukthika03" },
    { name: "Bandi Keerthi Krishna", role: "Member", team: "Frontend", image: "/team/bandi_keerthi_krishna.jpg", linkedin: "https://www.linkedin.com/in/bandikeerthikrishna", github: "https://github.com/bKeerthi-1205" },
    { name: "Shubha G D", role: "Member", team: "Frontend", image: "/team/shubha_g_d.jpg", linkedin: "https://www.linkedin.com/in/shubha-g-d-a879003b5", github: "https://github.com/gdshubha148" },
    { name: "Phani Kotha", role: "Member", team: "Frontend", image: "/team/kpvvssmphara.jpg", linkedin: "https://www.linkedin.com/in/phani-kotha-26073439b", github: "https://github.com/phanikotha18-sudo" },
    { name: "Praneetha Baru", role: "Lead", team: "Data", image: "/team/praneetha_baru.jpg", linkedin: "https://www.linkedin.com/in/praneetha-baru-0846b0295", github: "https://github.com/Praneetha7305" },
    { name: "Kavin Sarvesh", role: "Member", team: "Data", image: "/team/kavin_sarvesh.jpg", linkedin: "https://www.linkedin.com/in/kavin-sarvesh-813437360", github: "https://github.com/Kavinsarvesh2006" },
    { name: "Utukuri Naga Sri Hari Chandana", role: "Member", team: "Data", image: "/team/utukuri_naga_sri_hari_chandana.jpg", linkedin: "https://www.linkedin.com/in/naga-sri-hari-chandana-utukuri-541b072a3", github: "https://github.com/2300031149-chandana" },
    { name: "Akash Kumar Paswan", role: "Member", team: "Data", image: "/team/akash_kumar_paswan.jpg", linkedin: "https://www.linkedin.com/in/akash-kumar-paswan-951a13361", github: "https://github.com/Akashpaswan302" },
    { name: "Ganesh Goud Tekmul", role: "Member", team: "Data", image: "/team/ganesh_goud_tekmul.jpg", linkedin: "https://www.linkedin.com/in/ganesh-goud-a55a8b373/", github: "https://github.com/ganeshgoud96" }
];

const TEAM_GROUPS = [
    { id: 'Coordination', label: 'Leadership & Coordination' },
    { id: 'Model', label: 'AI & Modeling' },
    { id: 'Backend', label: 'Backend Engineering' },
    { id: 'Frontend', label: 'Frontend Engineering' },
    { id: 'Data', label: 'Data Engineering' }
];

export default function TeamSection() {
    return (
        <section className="py-16 sm:py-24 bg-white dark:bg-slate-950 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                <div className="text-center mb-20 space-y-4">
                    <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight font-syne">
                        Meet the Team
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xl mx-auto">
                        Built by engineers focused on intelligent support automation.
                    </p>
                </div>

                <div className="space-y-24">
                    {TEAM_GROUPS.map((group) => {
                        const members = TEAM_MEMBERS.filter(m => m.team === group.id);
                        if (!members.length) return null;

                        return (
                            <div key={group.id} className="space-y-12 flex flex-col items-center">
                                
                                <div className="w-full flex justify-center">
                                    <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] border-b border-gray-100 dark:border-slate-800 pb-4 text-center min-w-[250px]">
                                        {group.label}
                                    </h3>
                                </div>

                                <div className="flex flex-wrap justify-center gap-6 w-full">
                                    {members.map((member, i) => (
                                        <div 
                                            key={i} 
                                            className="group bg-gray-50/50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-2xl p-6 w-[240px] sm:w-[220px] flex flex-col items-center justify-center text-center hover:border-emerald-500/50 dark:hover:border-emerald-500/30 transition-all duration-300 hover:shadow-xl dark:hover:shadow-black/20"
                                        >
                                            <div className="w-24 h-24 mb-4 rounded-full bg-emerald-100/40 dark:bg-slate-800 overflow-hidden shadow-inner p-1">
                                                <img 
                                                    src={member.image} 
                                                    alt={member.name} 
                                                    className="w-full h-full object-cover rounded-full" 
                                                    onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=10b981&color=fff`; }} 
                                                />
                                            </div>

                                            <h4 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight mb-1">
                                                {member.name}
                                            </h4>
                                            
                                            <p className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider mb-6">
                                                {member.role}
                                            </p>

                                            <div className="flex items-center justify-center gap-4 mt-auto pt-2">
                                                <a 
                                                    href={member.github} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1"
                                                >
                                                    <Github size={18} />
                                                </a>
                                                <a 
                                                    href={member.linkedin} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1"
                                                >
                                                    <Linkedin size={18} />
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}