package com.projectmanagement.core_system.repository;

import com.projectmanagement.core_system.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.List;

@Repository
public interface UserRepository extends MongoRepository<User, String> {
    
    // --- SOFT DELETE FILTERED QUERIES (Using $ne: true to support existing data) ---
    
    @Query("{ 'isDeleted': { '$ne': true } }")
    List<User> findAllByIsDeletedFalse();
    
    @Query("{ 'email': { '$regex': ?0, '$options': 'i' }, 'isDeleted': { '$ne': true } }")
    Optional<User> findByEmailIgnoreCaseAndIsDeletedFalse(String email);
    
    @Query(value = "{ 'email': { '$regex': ?0, '$options': 'i' }, 'isDeleted': { '$ne': true } }", exists = true)
    boolean existsByEmailIgnoreCaseAndIsDeletedFalse(String email);
    
    @Query("{ 'department.$id': ?0, 'isDeleted': { '$ne': true } }")
    List<User> findByDepartment_IdAndIsDeletedFalse(String departmentId);

    @Query("{'$and': [ {'isDeleted': {'$ne': true}}, {'$or': [ {'fullName': { '$regex': ?0, '$options': 'i' }}, {'email': { '$regex': ?1, '$options': 'i' }} ]} ]}")
    List<User> searchActiveUsers(String fullName, String email);

    // --- LEGACY / UNFILTERED QUERIES (Includes Deleted) ---

    // Dùng để login hoặc check trùng email tuyệt đối
    Optional<User> findByEmail(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    Optional<User> findByGoogleSubject(String googleSubject);
    
    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCase(String email);

    List<User> findByDepartment_Id(String departmentId);

    List<User> findByFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(String fullName, String email);
}
