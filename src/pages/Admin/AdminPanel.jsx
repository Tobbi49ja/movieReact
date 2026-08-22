import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import SEOHelmet from "../../components/seo/SEOHelmet";
import Loader from "../../components/Loader";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3001"
    : "https://moviereact-zzye.onrender.com");

export default function AdminPanel() {
  const { user, token } = useAuth();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [userPage, setUserPage] = useState(1);
  const [userPages, setUserPages] = useState(1);
  const [comments, setComments] = useState([]);
  const [commentPage, setCommentPage] = useState(1);
  const [commentPages, setCommentPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const headers = { Authorization: `Bearer ${token}` };

  // Not logged in / not admin → home
  if (!user) return <Loader />;
  if (user.role !== "admin") return <Navigate to="/" replace />;

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/stats`, { headers });
      setStats(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load stats");
    }
  };

  const fetchUsers = async (page) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/users?page=${page}&limit=20`, { headers });
      setUsers(res.data.users);
      setUserPages(res.data.pages);
      setUserPage(res.data.page);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load users");
    }
  };

  const fetchComments = async (page) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/comments?page=${page}&limit=20`, { headers });
      setComments(res.data.comments);
      setCommentPages(res.data.pages);
      setCommentPage(res.data.page);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load comments");
    }
  };

  useEffect(() => {
    setLoading(true);
    if (tab === "overview") fetchStats();
    if (tab === "users") fetchUsers(1);
    if (tab === "comments") fetchComments(1);
    setLoading(false);
  }, [tab]);

  const handlePromote = async (userId) => {
    try {
      await axios.put(`${BACKEND_URL}/api/admin/users/${userId}/promote`, {}, { headers });
      toast.success("User promoted to admin");
      fetchUsers(userPage);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to promote user");
    }
  };

  const handleDemote = async (userId) => {
    try {
      await axios.put(`${BACKEND_URL}/api/admin/users/${userId}/demote`, {}, { headers });
      toast.success("User demoted");
      fetchUsers(userPage);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to demote user");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Delete this user? This cannot be undone.")) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/users/${userId}`, { headers });
      toast.success("User deleted");
      fetchUsers(userPage);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete user");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment? This cannot be undone.")) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/comments/${commentId}`, { headers });
      toast.success("Comment deleted");
      fetchComments(commentPage);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete comment");
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString() : "—";

  const statCards = stats
    ? [
        { label: "Total Users", value: stats.users },
        { label: "Comments", value: stats.comments },
        { label: "Reactions", value: stats.reactions },
        { label: "Watchlist Saves", value: stats.watchlistItems },
        { label: "Ratings", value: stats.ratings },
      ]
    : [];

  return (
    <main id="main-content" className="admin-page pulldown2">
      <SEOHelmet title="Admin Panel | Tobbihub" description="TobbiHub admin dashboard." />

      <h1 className="section-title">Admin Panel</h1>

      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        <button
          className={`admin-tab ${tab === "overview" ? "active" : ""}`}
          onClick={() => setTab("overview")}
          role="tab"
          aria-selected={tab === "overview"}
        >
          Overview
        </button>
        <button
          className={`admin-tab ${tab === "users" ? "active" : ""}`}
          onClick={() => setTab("users")}
          role="tab"
          aria-selected={tab === "users"}
        >
          Users
        </button>
        <button
          className={`admin-tab ${tab === "comments" ? "active" : ""}`}
          onClick={() => setTab("comments")}
          role="tab"
          aria-selected={tab === "comments"}
        >
          Comments
        </button>
      </div>

      {loading && !stats && !users.length && !comments.length ? (
        <Loader />
      ) : tab === "overview" ? (
        <div className="admin-stats-grid">
          {statCards.map((card) => (
            <div key={card.label} className="stat-card">
              <span className="stat-value">{card.value}</span>
              <span className="stat-label">{card.label}</span>
            </div>
          ))}
        </div>
      ) : tab === "users" ? (
        <section className="admin-section" aria-label="Users">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`role-badge role-${u.role}`}>{u.role}</span>
                  </td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td className="admin-actions">
                    {u._id !== user._id ? (
                      <>
                        {u.role !== "admin" ? (
                          <button className="admin-btn" onClick={() => handlePromote(u._id)}>
                            Promote
                          </button>
                        ) : (
                          <button className="admin-btn" onClick={() => handleDemote(u._id)}>
                            Demote
                          </button>
                        )}
                        <button className="admin-btn admin-btn-danger" onClick={() => handleDeleteUser(u._id)}>
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className="role-badge">you</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="admin-pagination">
            <button
              className="admin-btn"
              disabled={userPage <= 1}
              onClick={() => fetchUsers(userPage - 1)}
            >
              Prev
            </button>
            <span>Page {userPage} of {userPages}</span>
            <button
              className="admin-btn"
              disabled={userPage >= userPages}
              onClick={() => fetchUsers(userPage + 1)}
            >
              Next
            </button>
          </div>
        </section>
      ) : (
        <section className="admin-section" aria-label="Comments">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Comment</th>
                <th>Type</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {comments.map((c) => (
                <tr key={c._id}>
                  <td>{c.username}</td>
                  <td className="comment-cell">
                    {c.comment?.length > 80 ? c.comment.substring(0, 80) + "…" : c.comment}
                  </td>
                  <td>
                    <span className="role-badge role-comment">{c.contentType}</span>
                  </td>
                  <td>{formatDate(c.createdAt)}</td>
                  <td className="admin-actions">
                    <button className="admin-btn admin-btn-danger" onClick={() => handleDeleteComment(c._id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="admin-pagination">
            <button
              className="admin-btn"
              disabled={commentPage <= 1}
              onClick={() => fetchComments(commentPage - 1)}
            >
              Prev
            </button>
            <span>Page {commentPage} of {commentPages}</span>
            <button
              className="admin-btn"
              disabled={commentPage >= commentPages}
              onClick={() => fetchComments(commentPage + 1)}
            >
              Next
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
