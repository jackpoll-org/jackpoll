package org.acme.repository;

import java.time.LocalDate;

import org.acme.entity.JobRun;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class JobRunRepository implements PanacheRepositoryBase<JobRun, String> {

    /** Whether this caller won today's run of {@code job}; every other replica gets false. */
    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public boolean claim(String job, LocalDate day) {
        return getEntityManager().createNativeQuery(
                "insert into job_runs (name, run_on) values (?1, ?2) on conflict (name) do update"
                    + " set run_on = excluded.run_on where job_runs.run_on < excluded.run_on")
            .setParameter(1, job)
            .setParameter(2, day)
            .executeUpdate() == 1;
    }

    /** Held until the caller's transaction ends; false while another replica runs {@code job}. */
    public boolean tryLock(String job) {
        return (Boolean) getEntityManager()
            .createNativeQuery("select pg_try_advisory_xact_lock(hashtext(?1))")
            .setParameter(1, job)
            .getSingleResult();
    }
}
